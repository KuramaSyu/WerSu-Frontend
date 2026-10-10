// Tab / Shift+Tab handler for the codeBlock node.
//
// Why this exists:
// The previous handler lived inside `editorProps.handleKeyDown` and
// gated its work on `editor?.isActive("codeBlock")`, where `editor`
// was the React-side `useEditor` result. That closure is captured the
// first time Tiptap builds its view; on the first render `editor` is
// still `null`, so the predicate stays `false` forever and Tab falls
// through to the browser's default focus-traversal -- which is why
// pressing Tab in a codeBlock makes the caret jump out of the block.
//
// This handler reads selection ancestry directly from `view.state`
// so the gate never depends on a stale React closure, and it indents
// / outdents every line covered by a multi-line selection instead of
// just inserting a tab where the selection starts.

import type { EditorView } from "@tiptap/pm/view";
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";

/** Width of one indentation step. Two spaces matches the editor's
 *  paste / slash-command style and keeps the visual rhythm of the
 *  Monokai / GitHub codeBlock themes. */
const INDENT = "  ";

const CODE_BLOCK_NAME = "codeBlock";
const HARD_BREAK_NAME = "hardBreak";

/** Result of locating the codeBlock enclosing the caret. */
interface CodeBlockContext {
  /** Position immediately before the codeBlock's opening token. */
  readonly pos: number;
  /** Position right inside the codeBlock, just past the opening tag. */
  readonly innerStart: number;
  /** The codeBlock's content node, used to compute its inner extent. */
  readonly node: PMNode;
}

/** Locate the deepest codeBlock ancestor of `$from`. Returns `null`
 *  when the head of the selection lives outside any codeBlock, in
 *  which case the caller must let the default Tab behaviour run. */
const findCodeBlockAncestor = ($from: ResolvedPos): CodeBlockContext | null => {
  for (let d = $from.depth; d > 0; d--) {
    const ancestor = $from.node(d);
    if (ancestor.type.name === CODE_BLOCK_NAME) {
      const pos = $from.before(d);
      return { pos, innerStart: pos + 1, node: ancestor };
    }
  }
  return null;
};

/** All line-start positions inside a codeBlock, in document order.
 *
 *  A line starts at the first content position of the block and
 *  immediately after every `hardBreak` *and* every `\n` character
 *  inside a text node. The `\n` branch matters because Tiptap's
 *  CodeBlock stores pasted HTML paragraphs and `setContent` HTML
 *  as a single text node with embedded newlines rather than splitting
 *  them into separate hardBreak-bearing segments.
 */
const collectLineStarts = (
  view: EditorView,
  innerStart: number,
  innerEnd: number,
): number[] => {
  const starts: number[] = [innerStart];
  view.state.doc.nodesBetween(innerStart, innerEnd, (node, pos) => {
    if (node.type.name === HARD_BREAK_NAME) {
      starts.push(pos + 1);
      return;
    }
    if (!node.isText) return;
    const text = node.text ?? "";
    let cursor = 0;
    while (cursor < text.length) {
      const idx = text.indexOf("\n", cursor);
      if (idx === -1) break;
      starts.push(pos + idx + 1);
      cursor = idx + 1;
    }
  });
  return starts;
};

/** Count the leading spaces immediately AT `pos`, capped at
 *  `INDENT.length`. Used when `pos` is the start of a line and we
 *  want to peel back an indent that was already typed. */
const leadingSpacesAt = (view: EditorView, pos: number): number => {
  const slice = view.state.doc.textBetween(pos, pos + INDENT.length, "", "");
  let n = 0;
  for (let i = 0; i < slice.length && slice[i] === " "; i++) {
    n++;
  }
  return n;
};

/** Count the leading spaces immediately BEFORE `pos`, capped at
 *  `INDENT.length`. Used for an empty-selection Shift+Tab where
 *  the caret sits somewhere inside a line and we want to remove
 *  the indent that was already typed before the caret. */
const leadingSpacesBefore = (view: EditorView, pos: number): number => {
  const text = view.state.doc.textBetween(
    Math.max(0, pos - INDENT.length),
    pos,
    "",
    "",
  );
  let n = 0;
  for (let i = text.length - 1; i >= 0 && text[i] === " "; i--) {
    n++;
  }
  return Math.min(n, INDENT.length);
};

/**
 * Tab / Shift+Tab dispatch for codeBlock.
 *
 * @returns `true` when the event was consumed (caller should
 *          propagate `handleKeyDown: true`), `false` to let the
 *          editor's next handler run.
 */
export const handleCodeBlockTabKey = (
  view: EditorView,
  event: KeyboardEvent,
): boolean => {
  if (event.key !== "Tab") return false;

  const { state, dispatch } = view;
  const { selection } = state;
  const { $from, from, to, empty } = selection;

  const codeBlock = findCodeBlockAncestor($from);
  if (codeBlock === null) return false;

  // Inside a codeBlock: prevent the browser's focus-traversal default
  // before doing anything else so the caret stays anchored to the
  // block even when we end up making no change (e.g. Shift+Tab on a
  // line with no leading whitespace).
  event.preventDefault();

  const innerEnd = codeBlock.pos + codeBlock.node.nodeSize - 1;
  const lineStarts = collectLineStarts(view, codeBlock.innerStart, innerEnd);
  const outdent = event.shiftKey;

  let tr = state.tr;

  if (empty) {
    // Caret on a single line: Tab inserts indent at the caret,
    // Shift+Tab removes the indent that immediately precedes it.
    if (outdent) {
      const removable = leadingSpacesBefore(view, from);
      if (removable > 0) {
        tr = tr.delete(from - removable, from);
        dispatch(tr);
      }
    } else {
      tr = tr.insertText(INDENT, from, from);
      dispatch(tr);
    }
    return true;
  }

  // Non-empty selection: indent / outdent every line whose content
  // range overlaps the selection range. A line's content range is
  // `[lineStart, nextLineStart)` -- the last line extends to the
  // innerEnd of the codeBlock. Strict `<` on both sides keeps a
  // selection that ends exactly at a line start from outdenting /
  // indenting the following line.
  const targets: number[] = [];
  for (let i = 0; i < lineStarts.length; i++) {
    const lineStart = lineStarts[i];
    const lineEndExclusive =
      i + 1 < lineStarts.length ? lineStarts[i + 1] : innerEnd;
    if (lineStart < to && lineEndExclusive > from) {
      targets.push(lineStart);
    }
  }

  // Apply mutations from the rightmost line backwards so earlier
  // positions stay valid as the document grows / shrinks.
  const sortedTargets = [...targets].sort((a, b) => b - a);

  if (outdent) {
    for (const pos of sortedTargets) {
      const removable = leadingSpacesAt(view, pos);
      if (removable > 0) {
        tr = tr.delete(pos, pos + removable);
      }
    }
  } else {
    for (const pos of sortedTargets) {
      tr = tr.insertText(INDENT, pos, pos);
    }
  }

  dispatch(tr);
  return true;
};
