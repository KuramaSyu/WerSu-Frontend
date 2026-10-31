// Pull a code block out of the list it is nested in.
//
// This is the inverse of `codeBlockListIndent`: when a code block sits
// inside a list item (part of the enumeration), this moves it back out
// to sit right after the list, at the list's level.

import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";

const LIST_TYPE_NAMES = new Set(["bulletList", "orderedList", "taskList"]);
const CODE_BLOCK_NAME = "codeBlock";

export interface CodeBlockOutdentContext {
  /** The code block node containing the caret. */
  readonly codeBlock: PMNode;
  /** Position immediately before the code block node. */
  readonly codeBlockPos: number;
  /** The nearest list enclosing the code block. */
  readonly list: PMNode;
  /** Position immediately before the list node. */
  readonly listPos: number;
}

/**
 * Locates the code block at the caret together with the nearest list
 * that encloses it.
 *
 * Returns `null` when the caret is not inside a code block or that code
 * block is not nested in a list.
 */
export function findCodeBlockOutdentContext(
  state: EditorState,
): CodeBlockOutdentContext | null {
  const { $from } = state.selection;

  let codeBlock: PMNode | null = null;
  let codeBlockPos = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === CODE_BLOCK_NAME) {
      codeBlock = $from.node(depth);
      codeBlockPos = $from.before(depth);
      break;
    }
  }
  if (!codeBlock) return null;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (LIST_TYPE_NAMES.has(node.type.name)) {
      return {
        codeBlock,
        codeBlockPos,
        list: node,
        listPos: $from.before(depth),
      };
    }
  }
  return null;
}

/** Whether the caret's code block is nested in a list. */
export function canOutdentCodeBlockFromList(state: EditorState): boolean {
  return findCodeBlockOutdentContext(state) !== null;
}

/**
 * Moves the code block out of its enclosing list, placing it directly
 * after the list at the list's level.
 *
 * @returns `true` when the move was applied.
 */
export function outdentCodeBlockFromList(editor: Editor): boolean {
  const context = findCodeBlockOutdentContext(editor.state);
  if (!context) return false;

  const { codeBlock, codeBlockPos, list, listPos } = context;

  const tr = editor.state.tr;
  // Removing the block shrinks the list (and every ancestor) by exactly
  // its size, so the list's end shifts left by that amount.
  const afterList = listPos + list.nodeSize - codeBlock.nodeSize;
  tr.delete(codeBlockPos, codeBlockPos + codeBlock.nodeSize);
  tr.insert(afterList, codeBlock);
  // Keep the caret inside the block once it lands after the list.
  tr.setSelection(TextSelection.near(tr.doc.resolve(afterList + 1)));
  editor.view.dispatch(tr);
  return true;
}
