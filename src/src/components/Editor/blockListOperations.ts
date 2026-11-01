// Moving a block node (code block, image, blockquote, ...) between the
// document level and a list, or out of a list again.
//
// A block can be folded into the list directly above it so it becomes
// part of the enumeration, and pulled back out so it sits after the list
// at the list's own level. Both operations work on whatever block node
// encloses the selection (or the node selection itself), so the rail can
// offer the same controls for code blocks, images and blockquotes.

import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

const LIST_TYPE_NAMES = new Set(["bulletList", "orderedList", "taskList"]);

/**
 * How deep in lists the caret sits: 0 outside any list, 1 inside a
 * top-level list, 2 inside a list nested in a list item, and so on.
 */
export function selectionListLevel(state: EditorState): number {
  const { $from } = state.selection;
  let level = 0;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if (LIST_TYPE_NAMES.has($from.node(depth).type.name)) level += 1;
  }
  return level;
}

export interface BlockListContext {
  /** The block node that would move. */
  readonly block: PMNode;
  /** Position immediately before the block node. */
  readonly blockPos: number;
  /** The list directly above / before the block. */
  readonly list: PMNode;
  /** Position immediately before the list node. */
  readonly listPos: number;
}

interface BlockAtSelection {
  readonly block: PMNode;
  readonly blockPos: number;
  readonly parent: PMNode | null;
  readonly parentIndex: number;
}

/** Locates the block among `names` enclosing (or selected by) the caret. */
function findBlockAtSelection(
  state: EditorState,
  names: ReadonlySet<string>,
): BlockAtSelection | null {
  const { selection } = state;

  // A selected atom (image, ...) is a NodeSelection, not part of the
  // caret ancestry, so handle it before walking up from `$from`.
  if (selection instanceof NodeSelection && names.has(selection.node.type.name)) {
    const blockPos = selection.from;
    const $pos = state.doc.resolve(blockPos);
    return {
      block: selection.node,
      blockPos,
      parent: $pos.parent,
      parentIndex: $pos.index(),
    };
  }

  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const block = $from.node(depth);
    if (!names.has(block.type.name)) continue;
    return {
      block,
      blockPos: $from.before(depth),
      parent: $from.node(depth - 1),
      parentIndex: $from.index(depth - 1),
    };
  }
  return null;
}

/**
 * Locates a block together with the list directly preceding it, so it can
 * be folded into that list. Returns `null` when the caret is not in one of
 * `names`, the block is the first node in its parent, or its previous
 * sibling is not a list.
 */
export function findBlockListContext(
  state: EditorState,
  names: ReadonlySet<string>,
): BlockListContext | null {
  const found = findBlockAtSelection(state, names);
  if (!found || !found.parent) return null;
  const { block, blockPos, parent, parentIndex } = found;
  if (parentIndex === 0) return null;

  const list = parent.child(parentIndex - 1);
  if (!LIST_TYPE_NAMES.has(list.type.name)) return null;

  return { block, blockPos, list, listPos: blockPos - list.nodeSize };
}

/** Whether the caret's block can be folded into a preceding list. */
export function canIndentBlockIntoList(
  state: EditorState,
  names: ReadonlySet<string>,
): boolean {
  return findBlockListContext(state, names) !== null;
}

/**
 * Appends the block to the last item of the preceding list so it becomes
 * part of the enumeration.
 *
 * @returns `true` when the move was applied, `false` when not eligible.
 */
export function indentBlockIntoList(
  editor: Editor,
  names: ReadonlySet<string>,
): boolean {
  const context = findBlockListContext(editor.state, names);
  if (!context) return false;

  const { block, blockPos, list, listPos } = context;
  const insertPos = listPos + list.content.size;

  const tr = editor.state.tr;
  // The block sits after the insertion point, so deleting first leaves
  // the earlier insert position valid.
  tr.delete(blockPos, blockPos + block.nodeSize);
  tr.insert(insertPos, block);
  setSelectionOnBlock(editor, tr, insertPos);
  editor.view.dispatch(tr);
  return true;
}

/**
 * Locates a block nested in a list together with the nearest list that
 * encloses it.
 *
 * Returns `null` when the caret is not in one of `names` or that block is
 * not nested in a list.
 */
export function findBlockOutdentContext(
  state: EditorState,
  names: ReadonlySet<string>,
): BlockListContext | null {
  const found = findBlockAtSelection(state, names);
  if (!found || !found.parent) return null;

  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const list = $from.node(depth);
    if (!LIST_TYPE_NAMES.has(list.type.name)) continue;
    return {
      block: found.block,
      blockPos: found.blockPos,
      list,
      listPos: $from.before(depth),
    };
  }
  return null;
}

/** Whether the caret's block is nested in a list. */
export function canOutdentBlockFromList(
  state: EditorState,
  names: ReadonlySet<string>,
): boolean {
  return findBlockOutdentContext(state, names) !== null;
}

/**
 * Moves the block out of its enclosing list, placing it directly after
 * the list at the list's level.
 *
 * @returns `true` when the move was applied.
 */
export function outdentBlockFromList(
  editor: Editor,
  names: ReadonlySet<string>,
): boolean {
  const context = findBlockOutdentContext(editor.state, names);
  if (!context) return false;

  const { block, blockPos, list, listPos } = context;
  // Removing the block shrinks the list (and every ancestor) by exactly
  // its size, so the list's end shifts left by that amount.
  const afterList = listPos + list.nodeSize - block.nodeSize;

  const tr = editor.state.tr;
  tr.delete(blockPos, blockPos + block.nodeSize);
  tr.insert(afterList, block);
  setSelectionOnBlock(editor, tr, afterList);
  editor.view.dispatch(tr);
  return true;
}

/** Keeps the caret / selection anchored to the moved block. */
function setSelectionOnBlock(
  editor: Editor,
  tr: EditorState["tr"],
  blockPos: number,
): void {
  if (editor.state.selection instanceof NodeSelection) {
    tr.setSelection(NodeSelection.create(tr.doc, blockPos));
    return;
  }
  tr.setSelection(TextSelection.near(tr.doc.resolve(blockPos + 1)));
}
