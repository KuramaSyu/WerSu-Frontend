// Pull a code block out of the list it is nested in.
//
// This is the inverse of `codeBlockListIndent`: when a code block sits
// inside a list item (part of the enumeration), this moves it back out to
// sit right after the list, at the list's level. Thin wrapper around
// `blockListOperations` that fixes the block type to `codeBlock`.

import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import {
  canOutdentBlockFromList,
  findBlockOutdentContext,
  outdentBlockFromList,
} from "./blockListOperations";

const CODE_BLOCK_NAMES: ReadonlySet<string> = new Set(["codeBlock"]);

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
 * Locates the code block at the caret together with the nearest list that
 * encloses it.
 *
 * Returns `null` when the caret is not inside a code block or that code
 * block is not nested in a list.
 */
export function findCodeBlockOutdentContext(
  state: EditorState,
): CodeBlockOutdentContext | null {
  const context = findBlockOutdentContext(state, CODE_BLOCK_NAMES);
  if (!context) return null;
  return {
    codeBlock: context.block,
    codeBlockPos: context.blockPos,
    list: context.list,
    listPos: context.listPos,
  };
}

/** Whether the caret's code block is nested in a list. */
export function canOutdentCodeBlockFromList(state: EditorState): boolean {
  return canOutdentBlockFromList(state, CODE_BLOCK_NAMES);
}

/**
 * Moves the code block out of its enclosing list, placing it directly
 * after the list at the list's level.
 *
 * @returns `true` when the move was applied.
 */
export function outdentCodeBlockFromList(editor: Editor): boolean {
  return outdentBlockFromList(editor, CODE_BLOCK_NAMES);
}
