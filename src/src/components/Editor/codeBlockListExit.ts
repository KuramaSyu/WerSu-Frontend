// Pressing Enter at the end of a code block that is the last child of a
// list item should continue the enumeration instead of just adding a
// newline forever. This turns the usual "blank line then Enter" gesture
// into a brand new item in the same list, at the same level.
//
// Without it, the only way out of such a code block is `exitCode`
// (Mod-Enter / arrow-down), which drops an empty paragraph *inside*
// the current list item. Typing a bullet there nests a whole new list
// under the item instead of continuing the one above the code block.

import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";

const CODE_BLOCK_NAME = "codeBlock";
const LIST_ITEM_NAMES = new Set(["listItem", "taskItem"]);

export interface CodeBlockListExitContext {
  /** The code block node containing the caret. */
  readonly codeBlock: PMNode;
  /** Position immediately before the code block node. */
  readonly codeBlockPos: number;
  /** The list item that owns the code block. */
  readonly listItem: PMNode;
  /** Position immediately before the list item node. */
  readonly listItemPos: number;
}

/**
 * Locates a code block whose caret sits at its end and that is the last
 * child of a list item. Returns `null` for any other position.
 */
export function findCodeBlockListExitContext(
  state: EditorState,
): CodeBlockListExitContext | null {
  const { selection } = state;
  if (!selection.empty) return null;

  const { $from } = selection;
  if ($from.parent.type.name !== CODE_BLOCK_NAME) return null;
  // Caret must sit at the very end of the code block.
  if ($from.parentOffset !== $from.parent.nodeSize - 2) return null;
  // Exit only once the user has reached an empty final line (or the
  // block is empty from the start); otherwise Enter keeps adding lines.
  const text = $from.parent.textContent;
  if (text.length > 0 && !text.endsWith("\n")) return null;

  for (let depth = $from.depth - 1; depth > 0; depth -= 1) {
    const listItem = $from.node(depth);
    if (!LIST_ITEM_NAMES.has(listItem.type.name)) continue;

    // The code block must be the item's final child, so the new item is
    // the direct continuation of the enumeration.
    if ($from.index(depth) !== listItem.childCount - 1) return null;

    return {
      codeBlock: $from.parent,
      codeBlockPos: $from.before($from.depth),
      listItem,
      listItemPos: $from.before(depth),
    };
  }
  return null;
}

/** Whether Enter should leave the code block for a new list item. */
export function canExitCodeBlockToList(state: EditorState): boolean {
  return findCodeBlockListExitContext(state) !== null;
}

/**
 * Drops the blank final line and appends a fresh item to the same list,
 * placing the caret in it.
 *
 * @returns `true` when the move was applied.
 */
export function exitCodeBlockToList(editor: Editor): boolean {
  const context = findCodeBlockListExitContext(editor.state);
  if (!context) return false;

  const { codeBlock, codeBlockPos, listItem, listItemPos } = context;
  const newItem = listItem.type.createAndFill();
  if (!newItem) return false;

  const tr = editor.state.tr;
  // Trim the blank line that triggered the exit first (mirrors the
  // built-in triple-enter, which also drops the trailing empty line).
  // The item's end position shifts left with it.
  let insertPos = listItemPos + listItem.nodeSize;
  if (codeBlock.textContent.endsWith("\n")) {
    const end = codeBlockPos + codeBlock.nodeSize - 2;
    tr.delete(end, end + 1);
    insertPos -= 1;
  }

  // Append the new item right after the current one, at the same level.
  tr.insert(insertPos, newItem);
  // Caret just inside the new item's (empty) paragraph.
  tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 2)));
  editor.view.dispatch(tr);
  return true;
}
