// Inline note-reference autocomplete.
//
// Typing `{{` auto-inserts the closing `}}` and leaves the caret in the
// middle. While the caret sits inside a `{{...}}` block with a single
// word (no whitespace), the React menu searches notes for that word.
// Picking a result replaces the whole `{{word}}` block with a real
// `noteReference` atom, whose markdown serializer emits `{{@note-id}}`.
//
// ESC / a space dismisses the menu for that opening brace pair. Moving
// the caret outside the pair hides it automatically because the
// context resolver below no longer finds a valid open/close pair.

import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { NOTE_REFERENCE_NODE_NAME } from "./NoteReference";

export interface NoteReferenceAutocompleteContext {
  /** Absolute document position of the opening `{{`. */
  openPos: number;
  /** Absolute document position just after `{{`. */
  queryFrom: number;
  /** Absolute document position of the caret (end of the query). */
  queryTo: number;
  /** Absolute document position of the closing `}}`. */
  closeFrom: number;
  /** Absolute document position just after the closing `}}`. */
  closeTo: number;
  /** Text typed between `{{` and the caret. */
  query: string;
  /** Query sent to the notes search (leading `@` stripped). */
  searchQuery: string;
}

interface NoteReferenceAutocompleteState {
  /** Opening-brace position the user dismissed with ESC or a space. */
  dismissedAt: number | null;
}

type NoteReferenceAutocompleteMeta =
  | { type: "dismiss"; openPos: number }
  | { type: "clear" };

export const noteReferenceAutocompleteKey =
  new PluginKey<NoteReferenceAutocompleteState>("noteReferenceAutocomplete");

// Mirrors the slash menu: a meta-only dismissal does not trigger
// FloatingMenu's own shouldShow pass, so force a hide through the same
// plugin key the menu passes to `<FloatingMenu pluginKey=...>`.
export const noteReferenceAutocompleteFloatingKey = new PluginKey(
  "noteReferenceAutocompleteFloating",
);

const initialAutocompleteState: NoteReferenceAutocompleteState = {
  dismissedAt: null,
};

/** True inside a code block or inline `code` mark (literal `{{`). */
function isCodeContext(state: EditorState, pos: number): boolean {
  const { doc, schema } = state;
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));

  if (schema.nodes.codeBlock) {
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type === schema.nodes.codeBlock) {
        return true;
      }
    }
  }

  if (schema.marks.code) {
    const marks = [...$pos.marks(), ...($pos.nodeAfter?.marks ?? [])];
    if (marks.some((mark) => mark.type === schema.marks.code)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve the `{{...}}` block around the current empty selection.
 *
 * Returns `null` when any of these is true:
 * - the selection is a range / not in a text block
 * - there is no opening `{{` before the caret
 * - the caret is already past a closing `}}`
 * - the query contains whitespace
 * - there is no closing `}}` after the caret
 */
export function getNoteReferenceAutocompleteContext(
  editor: Editor,
): NoteReferenceAutocompleteContext | null {
  const { state } = editor;
  const { selection } = state;
  if (!selection.empty) return null;

  const $from = selection.$from;
  if (!$from.parent.isTextblock) return null;
  if ($from.parent.type.name === "codeBlock") return null;

  const before = $from.parent.textBetween(
    0,
    $from.parentOffset,
    "\n",
    "\n",
  );
  const after = $from.parent.textBetween(
    $from.parentOffset,
    $from.parent.content.size,
    "\n",
    "\n",
  );

  const openIdx = before.lastIndexOf("{{");
  if (openIdx === -1) return null;
  // A complete closing pair before the caret means we are outside the
  // block (for example `{{@old}}|`).
  if (before.indexOf("}}", openIdx + 2) !== -1) return null;

  const closeIdx = after.indexOf("}}");
  if (closeIdx === -1) return null;

  const query = before.slice(openIdx + 2);
  if (/\s/.test(query)) return null;

  const blockStart = $from.start();
  const openPos = blockStart + openIdx;
  const queryFrom = openPos + 2;
  const queryTo = selection.from;
  const closeFrom = queryTo + closeIdx;
  const closeTo = closeFrom + 2;

  return {
    openPos,
    queryFrom,
    queryTo,
    closeFrom,
    closeTo,
    query,
    searchQuery: query.startsWith("@") ? query.slice(1) : query,
  };
}

/** True when the menu should be visible for the current editor state. */
export function isNoteReferenceAutocompleteOpen(editor: Editor): boolean {
  const context = getNoteReferenceAutocompleteContext(editor);
  if (!context) return false;
  const state = noteReferenceAutocompleteKey.getState(editor.state);
  return state?.dismissedAt !== context.openPos;
}

const dismissAutocomplete = (view: EditorView, openPos: number): void => {
  const tr = view.state.tr
    .setMeta(noteReferenceAutocompleteKey, {
      type: "dismiss",
      openPos,
    } satisfies NoteReferenceAutocompleteMeta)
    .setMeta(noteReferenceAutocompleteFloatingKey, "hide");
  view.dispatch(tr);
};

/**
 * Auto-inserts the closing `}}` when the user types the second `{`.
 * Exported so the input behavior can be unit-tested through
 * ProseMirror's `handleTextInput` prop.
 */
export function handleNoteReferenceBraceInput(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): boolean {
  if (from !== to) return false;
  if (isCodeContext(view.state, from)) return false;

  // Pasting `{{` as one input event.
  if (text === "{{") {
    const tr = view.state.tr.insertText("{{}}", from, to);
    tr.setSelection(TextSelection.create(tr.doc, from + 2));
    tr.setMeta(noteReferenceAutocompleteKey, { type: "clear" });
    view.dispatch(tr);
    return true;
  }

  if (text !== "{") return false;

  const beforeChar = view.state.doc.textBetween(
    Math.max(0, from - 1),
    from,
    "\n",
    "\n",
  );
  if (beforeChar !== "{") return false;

  // Already between an auto-inserted `{{|}}` (or typing a literal `{`
  // inside an existing block): do not nest another pair.
  const after = view.state.doc.textBetween(
    to,
    Math.min(view.state.doc.content.size, to + 2),
    "\n",
    "\n",
  );
  if (after === "}}") return false;

  const start = from - 1;
  const tr = view.state.tr.insertText("{{}}", start, to);
  tr.setSelection(TextSelection.create(tr.doc, start + 2));
  tr.setMeta(noteReferenceAutocompleteKey, { type: "clear" });
  view.dispatch(tr);
  return true;
}

/**
 * Replace the current `{{query}}` block with a note-reference atom.
 * Used by the autocomplete menu; exposed for tests.
 */
export function insertNoteReferenceFromAutocomplete(
  editor: Editor,
  context: NoteReferenceAutocompleteContext,
  noteId: string,
): void {
  const nodeType = editor.schema.nodes[NOTE_REFERENCE_NODE_NAME];
  if (!nodeType) return;

  const node = nodeType.create({ noteId, section: "" });
  const tr = editor.state.tr
    .replaceWith(context.openPos, context.closeTo, node)
    .setMeta(noteReferenceAutocompleteKey, { type: "clear" });
  // Place the caret after the inserted atom so typing can continue.
  tr.setSelection(
    TextSelection.create(tr.doc, context.openPos + node.nodeSize),
  );
  editor.view.dispatch(tr);
  editor.view.focus();
}

export const NoteReferenceAutocompleteExtension = Extension.create({
  name: "noteReferenceAutocomplete",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin<NoteReferenceAutocompleteState>({
        key: noteReferenceAutocompleteKey,

        state: {
          init: () => initialAutocompleteState,
          apply(tr, value) {
            const meta = tr.getMeta(noteReferenceAutocompleteKey) as
              | NoteReferenceAutocompleteMeta
              | undefined;
            if (meta?.type === "clear") {
              return { dismissedAt: null };
            }
            if (meta?.type === "dismiss") {
              return { dismissedAt: meta.openPos };
            }
            return value;
          },
        },

        props: {
          handleTextInput(view, from, to, text) {
            if (handleNoteReferenceBraceInput(view, from, to, text)) {
              return true;
            }

            // A space inside `{{query}}` ends the autocomplete context.
            const context = getNoteReferenceAutocompleteContext(editor);
            if (context && /\s/.test(text)) {
              dismissAutocomplete(view, context.openPos);
            }
            return false;
          },

          handleKeyDown(view, event) {
            if (event.key !== "Escape") return false;
            const context = getNoteReferenceAutocompleteContext(editor);
            if (!context) return false;
            if (!isNoteReferenceAutocompleteOpen(editor)) {
              return false;
            }
            dismissAutocomplete(view, context.openPos);
            return false;
          },
        },
      }),
    ];
  },
});