// Move a code block into the list directly above it, so the block
// becomes part of the enumeration instead of a floating sibling.
//
// The right-rail code block tools surface this only when the code
// block's immediate previous sibling is a bullet / ordered / task
// list, i.e. the block sits directly between or below a list. Moving
// the block appends it to the last item of that list.

import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";

const LIST_TYPE_NAMES = new Set(["bulletList", "orderedList", "taskList"]);
const CODE_BLOCK_NAME = "codeBlock";

export interface CodeBlockListContext {
  /** The code block node containing the caret. */
  readonly codeBlock: PMNode;
  /** Position immediately before the code block node. */
  readonly codeBlockPos: number;
  /** The list directly above / before the code block. */
  readonly list: PMNode;
  /** Position immediately before the list node. */
  readonly listPos: number;
}

/**
 * Locates the code block at the caret together with the list directly
 * preceding it.
 *
 * Returns `null` when the caret is not inside a code block, the code
 * block is the first node in its parent, or its previous sibling is not
 * a list.
 */
export function findCodeBlockListContext(
  state: EditorState,
): CodeBlockListContext | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const codeBlock = $from.node(depth);
    if (codeBlock.type.name !== CODE_BLOCK_NAME) continue;

    const parentIndex = $from.index(depth - 1);
    if (parentIndex === 0) return null;

    const list = $from.node(depth - 1).child(parentIndex - 1);
    if (!LIST_TYPE_NAMES.has(list.type.name)) return null;

    const codeBlockPos = $from.before(depth);
    return {
      codeBlock,
      codeBlockPos,
      list,
      listPos: codeBlockPos - list.nodeSize,
    };
  }
  return null;
}

/** Whether the caret's code block can be folded into a preceding list. */
export function canIndentCodeBlockIntoList(state: EditorState): boolean {
  return findCodeBlockListContext(state) !== null;
}

/**
 * Appends the code block to the last item of the preceding list so it
 * becomes part of the enumeration.
 *
 * @returns `true` when the move was applied, `false` when the code
 *          block is not eligible.
 */
export function indentCodeBlockIntoList(editor: Editor): boolean {
  const context = findCodeBlockListContext(editor.state);
  if (!context) return false;

  const { codeBlock, codeBlockPos, list, listPos } = context;

  // End of the last list item's content: the position after its final
  // child, still inside the item (before the item's closing token).
  // Derived as `listPos + list.content.size`.
  const insertPos = listPos + list.content.size;

  const tr = editor.state.tr;
  // Delete first: the code block sits after the insertion point, so the
  // earlier position used for the insert is unaffected by the removal.
  tr.delete(codeBlockPos, codeBlockPos + codeBlock.nodeSize);
  tr.insert(insertPos, codeBlock);
  // Keep the caret inside the block once it lands in the list item.
  tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
  editor.view.dispatch(tr);
  return true;
}
