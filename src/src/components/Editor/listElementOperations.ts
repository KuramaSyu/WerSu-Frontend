// Moving the element under the caret up / down inside a list.
//
// Two shapes are covered:
//
// - Caret in an item's first paragraph (the bullet's own text): the whole
//   list item is reordered within the list.
// - Caret in a nested block (code block, image, ...): the block is
//   reordered against its siblings. At the top of a list item it crosses
//   into the previous item; at the bottom it crosses into the next, so a
//   block can travel between bullets. This keeps the "listItem starts
//   with a paragraph" schema rule intact - the paragraph never moves.

import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

const LIST_ITEM_NAMES = new Set(["listItem", "taskItem"]);
const LIST_TYPE_NAMES = new Set(["bulletList", "orderedList", "taskList"]);

export interface ListElementMoveState {
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
}

export type ListMergeDirection = "up" | "down";

export interface ListElementMergeState {
  readonly canMerge: boolean;
  /** Which neighbour the current item would be folded into. */
  readonly direction: ListMergeDirection;
}

/** Absolute document ranges of the two bullets a merge would join. */
export interface ListMergePreview {
  readonly direction: ListMergeDirection;
  /** The surviving bullet - highlighted with the primary colour. */
  readonly primaryFrom: number;
  readonly primaryTo: number;
  /** The consumed bullet - highlighted with the secondary colour. */
  readonly secondaryFrom: number;
  readonly secondaryTo: number;
}

interface ListElementContext {
  readonly list: PMNode;
  readonly listPos: number;
  readonly listIndex: number;
  readonly listItem: PMNode;
  readonly child: PMNode;
  readonly childIndex: number;
}

function findListElementContext(state: EditorState): ListElementContext | null {
  const { $from } = state.selection;

  let listItemDepth = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if (LIST_ITEM_NAMES.has($from.node(depth).type.name)) {
      listItemDepth = depth;
      break;
    }
  }
  if (listItemDepth === -1) return null;

  const list = $from.node(listItemDepth - 1);
  if (!LIST_TYPE_NAMES.has(list.type.name)) return null;

  const listItem = $from.node(listItemDepth);
  const childIndex = $from.index(listItemDepth);
  const child = listItem.child(childIndex);
  if (!child) return null;

  return {
    list,
    listPos: $from.before(listItemDepth - 1),
    listIndex: $from.index(listItemDepth - 1),
    listItem,
    child,
    childIndex,
  };
}

/**
 * Bounds for the move buttons, or `null` when the caret is not inside a
 * list item (so the caller can hide the controls entirely).
 */
export function getListElementMoveState(
  state: EditorState,
): ListElementMoveState | null {
  const context = findListElementContext(state);
  if (!context) return null;

  const { list, listIndex, listItem, childIndex } = context;

  // Paragraph -> reorder whole item.
  if (childIndex === 0) {
    return {
      canMoveUp: listIndex > 0,
      canMoveDown: listIndex < list.childCount - 1,
    };
  }

  // Nested block -> swap within the item, or cross at the edges.
  return {
    canMoveUp: childIndex >= 2 || listIndex > 0,
    canMoveDown:
      childIndex < listItem.childCount - 1 ||
      listIndex < list.childCount - 1,
  };
}

/**
 * Moves the element under the caret up (`delta === -1`) or down
 * (`delta === 1`).
 *
 * @returns `true` when the document changed.
 */
export function moveListElement(editor: Editor, delta: -1 | 1): boolean {
  const context = findListElementContext(editor.state);
  if (!context) return false;

  const bounds = getListElementMoveState(editor.state);
  if (!bounds) return false;
  if (delta === -1 && !bounds.canMoveUp) return false;
  if (delta === 1 && !bounds.canMoveDown) return false;

  const { list, listPos, listIndex, listItem, child, childIndex } = context;

  const items = list.content.content.slice();
  const children = listItem.content.content.slice();
  let movedChild = child;

  const swapWithinItem = () => {
    const target = childIndex + delta;
    [children[target], children[childIndex]] = [
      children[childIndex],
      children[target],
    ];
    items[listIndex] = listItem.type.create(
      listItem.attrs,
      children,
      listItem.marks,
    );
  };

  if (childIndex === 0) {
    // Whole-item reorder: swap the two list items.
    const target = listIndex + delta;
    [items[target], items[listIndex]] = [items[listIndex], items[target]];
  } else if (
    (delta === -1 && childIndex >= 2) ||
    (delta === 1 && childIndex < listItem.childCount - 1)
  ) {
    swapWithinItem();
  } else {
    // Edge block: carry it into the adjacent item.
    const adjacentIndex = listIndex + delta;
    const [removed] = children.splice(childIndex, 1);
    movedChild = removed;
    const adjacentItem = items[adjacentIndex];
    const adjacentChildren = adjacentItem.content.content.slice();
    adjacentChildren.push(removed);
    items[listIndex] = listItem.type.create(
      listItem.attrs,
      children,
      listItem.marks,
    );
    items[adjacentIndex] = adjacentItem.type.create(
      adjacentItem.attrs,
      adjacentChildren,
      adjacentItem.marks,
    );
  }

  const newList = list.type.create(list.attrs, items, list.marks);
  const tr = editor.state.tr.replaceWith(
    listPos,
    listPos + list.nodeSize,
    newList,
  );

  // Find the moved node by identity so the caret follows it.
  let movedPos = -1;
  tr.doc.descendants((node, pos) => {
    if (node === movedChild) {
      movedPos = pos;
      return false;
    }
    return true;
  });

  if (movedPos !== -1) {
    tr.setSelection(
      editor.state.selection instanceof NodeSelection
        ? NodeSelection.create(tr.doc, movedPos)
        : TextSelection.near(tr.doc.resolve(movedPos + 1)),
    );
  }

  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}

/**
 * Whether the list item under the caret can be folded into an adjacent
 * bullet. Two neighbouring items qualify when their text differs, so
 * identical bullets never offer a no-op merge. Prefers folding the
 * current item into the next one; falls back to the previous item when
 * the caret sits on the last bullet.
 */
export function getListElementMergeState(
  state: EditorState,
): ListElementMergeState | null {
  const context = findListElementContext(state);
  if (!context) return null;

  const { list, listIndex } = context;
  const current = list.child(listIndex);
  const next = listIndex < list.childCount - 1 ? list.child(listIndex + 1) : null;
  const previous = listIndex > 0 ? list.child(listIndex - 1) : null;
  const differs = (other: PMNode): boolean =>
    other.textContent.trim() !== current.textContent.trim();

  if (next && differs(next)) return { canMerge: true, direction: "down" };
  if (previous && differs(previous))
    return { canMerge: true, direction: "up" };

  return { canMerge: false, direction: next ? "down" : "up" };
}

/**
 * Document ranges for the merge hover preview, or `null` when the
 * current bullet cannot be merged. The surviving bullet is `primary`,
 * the consumed one `secondary`.
 */
export function getListElementMergePreview(
  state: EditorState,
): ListMergePreview | null {
  const merge = getListElementMergeState(state);
  if (!merge?.canMerge) return null;

  const context = findListElementContext(state);
  if (!context) return null;

  const { list, listPos, listIndex } = context;
  const targetIndex =
    merge.direction === "down" ? listIndex + 1 : listIndex - 1;
  if (targetIndex < 0 || targetIndex >= list.childCount) return null;

  // Walk the list children to translate child indexes into absolute
  // document positions (the list content starts one past `listPos`).
  let offset = listPos + 1;
  let currentFrom = -1;
  let targetFrom = -1;
  for (let index = 0; index < list.childCount; index += 1) {
    if (index === listIndex) currentFrom = offset;
    if (index === targetIndex) targetFrom = offset;
    offset += list.child(index).nodeSize;
  }
  if (currentFrom < 0 || targetFrom < 0) return null;

  const current = {
    from: currentFrom,
    to: currentFrom + list.child(listIndex).nodeSize,
  };
  const target = {
    from: targetFrom,
    to: targetFrom + list.child(targetIndex).nodeSize,
  };
  const primary = merge.direction === "down" ? current : target;
  const secondary = merge.direction === "down" ? target : current;

  return {
    direction: merge.direction,
    primaryFrom: primary.from,
    primaryTo: primary.to,
    secondaryFrom: secondary.from,
    secondaryTo: secondary.to,
  };
}

/** Appends `other`'s blocks onto `base`, joining the two lead paragraphs. */
function mergeItemContent(
  base: PMNode,
  other: PMNode,
  editor: Editor,
): PMNode[] {
  const children = base.content.content.slice();
  const otherChildren = other.content.content.slice();
  const first = children[0];
  const otherFirst = otherChildren[0];

  if (first?.isTextblock && otherFirst?.isTextblock) {
    const inline = first.content.content.slice();
    if (otherFirst.content.size > 0) {
      if (inline.length > 0) inline.push(editor.schema.text(" "));
      inline.push(...otherFirst.content.content);
    }
    children[0] = first.type.create(first.attrs, inline, first.marks);
    otherChildren.shift();
  }

  children.push(...otherChildren);
  return children;
}

/**
 * Folds the item under the caret into an adjacent bullet. The text of
 * the two items is joined into the surviving item's lead paragraph;
 * any nested blocks of the consumed item move across with it.
 *
 * @returns `true` when the document changed.
 */
export function mergeListItem(
  editor: Editor,
  direction: ListMergeDirection,
): boolean {
  const context = findListElementContext(editor.state);
  if (!context) return false;

  const state = getListElementMergeState(editor.state);
  if (!state?.canMerge) return false;

  const { list, listPos, listIndex, listItem } = context;
  const items = list.content.content.slice();
  const targetIndex = direction === "down" ? listIndex + 1 : listIndex - 1;
  if (targetIndex < 0 || targetIndex >= items.length) return false;

  // The surviving item is whichever sits first; the other is folded in.
  const baseIndex = Math.min(listIndex, targetIndex);
  const consumedIndex = Math.max(listIndex, targetIndex);
  const base = items[baseIndex];
  const consumed = items[consumedIndex];

  const mergedItem = listItem.type.create(
    base.attrs,
    mergeItemContent(base, consumed, editor),
    base.marks,
  );

  items[baseIndex] = mergedItem;
  items.splice(consumedIndex, 1);

  const newList = list.type.create(list.attrs, items, list.marks);
  const tr = editor.state.tr.replaceWith(
    listPos,
    listPos + list.nodeSize,
    newList,
  );

  // Place the caret at the seam where the two items were joined.
  let mergedPos = -1;
  tr.doc.descendants((node, pos) => {
    if (node === mergedItem) {
      mergedPos = pos;
      return false;
    }
    return true;
  });
  if (mergedPos !== -1) {
    tr.setSelection(
      TextSelection.near(tr.doc.resolve(mergedPos + mergedItem.nodeSize - 1)),
    );
  }

  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}
