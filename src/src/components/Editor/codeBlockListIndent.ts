// Move a code block into the list directly above it, so the block
// becomes part of the enumeration instead of a floating sibling.
//
// Thin wrapper around `blockListOperations` that fixes the block type to
// `codeBlock`. The right-rail code block tools surface this only when the
// block's immediate previous sibling is a list.

import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import {
  canIndentBlockIntoList,
  findBlockListContext,
  indentBlockIntoList,
} from "./blockListOperations";

const CODE_BLOCK_NAMES: ReadonlySet<string> = new Set(["codeBlock"]);

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
  const context = findBlockListContext(state, CODE_BLOCK_NAMES);
  if (!context) return null;
  return {
    codeBlock: context.block,
    codeBlockPos: context.blockPos,
    list: context.list,
    listPos: context.listPos,
  };
}

/** Whether the caret's code block can be folded into a preceding list. */
export function canIndentCodeBlockIntoList(state: EditorState): boolean {
  return canIndentBlockIntoList(state, CODE_BLOCK_NAMES);
}

/**
 * Appends the code block to the last item of the preceding list so it
 * becomes part of the enumeration.
 *
 * @returns `true` when the move was applied, `false` when the code
 *          block is not eligible.
 */
export function indentCodeBlockIntoList(editor: Editor): boolean {
  return indentBlockIntoList(editor, CODE_BLOCK_NAMES);
}
