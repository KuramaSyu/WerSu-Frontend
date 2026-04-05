import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

/**
 * Internal plugin state.
 * `pos` stores the start position of the block currently hovered during drag.
 */
interface BlockDropHighlightState {
  pos: number | null;
  side: "above" | "below";
  draggedKind: "none" | "top-level" | "list-item";
  draggedPos: number | null;
  draggedLabel: string;
}

const blockDropHighlightKey = new PluginKey<BlockDropHighlightState>(
  "blockDropHighlight",
);

const LIST_CONTAINER_TYPES = new Set(["bulletList", "orderedList"]);

/**
 * Resolve the nearest node start position for a specific node type.
 *
 * We walk up the resolved position depth and return the first matching node.
 */
const findNearestPosByType = (
  docPos: number,
  stateDoc: ProseMirrorNode,
  typeName: string,
): number | null => {
  const $pos = stateDoc.resolve(docPos);

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.type.name === typeName) {
      return $pos.before(depth);
    }
  }

  return null;
};

/**
 * Resolve the top-level (direct child of doc) block position for a document position.
 */
const findTopLevelBlockPos = (
  docPos: number,
  stateDoc: ProseMirrorNode,
): number | null => {
  const $pos = stateDoc.resolve(docPos);
  if ($pos.depth < 1) {
    return null;
  }

  const topLevelNode = $pos.node(1);
  if (!topLevelNode?.isBlock) {
    return null;
  }

  return $pos.before(1);
};

const isTopLevelBlockAt = (doc: ProseMirrorNode, pos: number): boolean => {
  const node = doc.nodeAt(pos);
  if (!node || !node.isBlock) {
    return false;
  }

  const $pos = doc.resolve(pos);
  return $pos.depth === 1;
};

const getDragKindFromSelection = (
  selection: { from: number } | NodeSelection,
  doc: ProseMirrorNode,
): BlockDropHighlightState["draggedKind"] => {
  if (!(selection instanceof NodeSelection) || !selection.node.isBlock) {
    // Fallback for selections like CellSelection (tables): infer top-level block from cursor.
    const topLevelPos = findTopLevelBlockPos(selection.from, doc);
    const topLevelNode = topLevelPos === null ? null : doc.nodeAt(topLevelPos);
    return topLevelNode?.isBlock ? "top-level" : "none";
  }

  if (selection.node.type.name === "listItem") {
    return "list-item";
  }

  if (isTopLevelBlockAt(doc, selection.from)) {
    return "top-level";
  }

  return "none";
};

const getDragSourceFromSelection = (
  selection: { from: number } | NodeSelection,
  doc: ProseMirrorNode,
): Pick<BlockDropHighlightState, "draggedKind" | "draggedPos"> => {
  if (!(selection instanceof NodeSelection) || !selection.node.isBlock) {
    // Fallback for selections like table CellSelection.
    const topLevelPos = findTopLevelBlockPos(selection.from, doc);
    if (topLevelPos !== null) {
      const topNode = doc.nodeAt(topLevelPos);
      if (topNode?.isBlock) {
        return { draggedKind: "top-level", draggedPos: topLevelPos };
      }
    }
    return { draggedKind: "none", draggedPos: null };
  }

  if (selection.node.type.name === "listItem") {
    const $from = doc.resolve(selection.from);

    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (!LIST_CONTAINER_TYPES.has(node.type.name)) {
        continue;
      }

      const listPos = $from.before(depth);
      const isTopLevelList = depth === 1;
      const isFirstItemInList = selection.from === listPos + 1;

      if (isTopLevelList && isFirstItemInList) {
        // Allow dragging the whole top-level bullet/ordered list using first-item handle.
        return { draggedKind: "top-level", draggedPos: listPos };
      }

      return { draggedKind: "list-item", draggedPos: selection.from };
    }

    return { draggedKind: "list-item", draggedPos: selection.from };
  }

  if (isTopLevelBlockAt(doc, selection.from)) {
    return { draggedKind: "top-level", draggedPos: selection.from };
  }

  return { draggedKind: "none", draggedPos: null };
};

const inferDragKind = (
  view: EditorView,
  currentKind: BlockDropHighlightState["draggedKind"],
): BlockDropHighlightState["draggedKind"] => {
  if (currentKind !== "none") {
    return currentKind;
  }

  const fromSelection = getDragKindFromSelection(
    view.state.selection,
    view.state.doc,
  );
  if (fromSelection !== "none") {
    return fromSelection;
  }

  // Fallback: ProseMirror stores drag info on the view during active drags.
  const draggingSlice = (
    view as unknown as {
      dragging?: {
        slice?: {
          content?: {
            firstChild?: { type?: { name?: string }; isBlock?: boolean };
          };
        };
      };
    }
  ).dragging?.slice;
  const firstChild = draggingSlice?.content?.firstChild;

  if (firstChild?.type?.name === "listItem") {
    return "list-item";
  }
  if (firstChild?.isBlock) {
    return "top-level";
  }

  return "none";
};

const inferDragSource = (
  view: EditorView,
  pluginState: BlockDropHighlightState | undefined,
): Pick<BlockDropHighlightState, "draggedKind" | "draggedPos"> => {
  if (
    pluginState &&
    pluginState.draggedKind !== "none" &&
    pluginState.draggedPos !== null
  ) {
    return {
      draggedKind: pluginState.draggedKind,
      draggedPos: pluginState.draggedPos,
    };
  }

  const fromSelection = getDragSourceFromSelection(
    view.state.selection,
    view.state.doc,
  );
  if (fromSelection.draggedKind !== "none") {
    return fromSelection;
  }

  return {
    draggedKind: inferDragKind(view, pluginState?.draggedKind ?? "none"),
    draggedPos: null,
  };
};

const normalizePosForKind = (
  rawPos: number,
  doc: ProseMirrorNode,
  draggedKind: BlockDropHighlightState["draggedKind"],
): number | null => {
  if (draggedKind === "top-level") {
    return findTopLevelBlockPos(rawPos, doc);
  }

  if (draggedKind === "list-item") {
    return findNearestPosByType(rawPos, doc, "listItem");
  }

  return null;
};

const inferDraggedPosFromDom = (
  view: EditorView,
  draggedKind: BlockDropHighlightState["draggedKind"],
): number | null => {
  let selectedDom = view.dom.querySelector(".ProseMirror-selectednode");

  while (selectedDom instanceof HTMLElement) {
    try {
      const rawPos = view.posAtDOM(selectedDom, 0);
      return normalizePosForKind(rawPos, view.state.doc, draggedKind);
    } catch {
      selectedDom = selectedDom.parentElement;
    }
  }

  return null;
};

const resolveTargetPos = (
  rawPos: number,
  doc: ProseMirrorNode,
  draggedKind: BlockDropHighlightState["draggedKind"],
): number | null => {
  if (draggedKind === "list-item") {
    return findNearestPosByType(rawPos, doc, "listItem");
  }

  if (draggedKind === "top-level") {
    return findTopLevelBlockPos(rawPos, doc);
  }

  return null;
};

const getTableSize = (
  tableNode: ProseMirrorNode,
): { rows: number; cols: number } => {
  const rows = tableNode.childCount;
  const firstRow = rows > 0 ? tableNode.child(0) : null;
  const cols = firstRow ? firstRow.childCount : 0;
  return { rows, cols };
};

const getDraggedElementLabel = (
  draggedNode: ProseMirrorNode | null,
  draggedKind: BlockDropHighlightState["draggedKind"],
): string => {
  if (!draggedNode) {
    return "Element";
  }

  if (draggedNode.type.name === "table") {
    const { rows, cols } = getTableSize(draggedNode);
    return `${rows}x${cols} table`;
  }

  if (
    draggedNode.type.name === "bulletList" ||
    draggedNode.type.name === "orderedList"
  ) {
    const count = draggedNode.childCount;
    return `${count} bullet points`;
  }

  if (draggedNode.type.name === "listItem" || draggedKind === "list-item") {
    return "Bullet point";
  }

  if (draggedNode.type.name === "paragraph") {
    return "Paragraph";
  }

  if (draggedNode.type.name === "heading") {
    return "Heading";
  }

  if (draggedNode.type.name === "codeBlock") {
    return "Code block";
  }

  if (draggedNode.type.name === "image") {
    return "Image";
  }

  return "Element";
};

const inferDraggedNodeFromView = (view: EditorView): ProseMirrorNode | null => {
  const selection = view.state.selection;
  if (selection instanceof NodeSelection && selection.node.isBlock) {
    return selection.node;
  }

  const draggingSlice = (
    view as unknown as {
      dragging?: {
        slice?: {
          content?: { firstChild?: ProseMirrorNode };
        };
      };
    }
  ).dragging?.slice;

  return draggingSlice?.content?.firstChild ?? null;
};

const moveBlockByPos = (
  view: EditorView,
  fromPos: number,
  targetPos: number,
  side: "above" | "below",
): boolean => {
  const doc = view.state.doc;
  const draggedNode = doc.nodeAt(fromPos);
  const targetNode = doc.nodeAt(targetPos);

  if (
    !draggedNode ||
    !draggedNode.isBlock ||
    !targetNode ||
    !targetNode.isBlock
  ) {
    return false;
  }

  let insertPos =
    side === "above" ? targetPos : targetPos + targetNode.nodeSize;

  if (insertPos > fromPos && insertPos < fromPos + draggedNode.nodeSize) {
    return false;
  }

  let tr: Transaction = view.state.tr;
  tr = tr.delete(fromPos, fromPos + draggedNode.nodeSize);

  if (insertPos > fromPos) {
    insertPos -= draggedNode.nodeSize;
  }

  const clampedInsertPos = Math.max(
    0,
    Math.min(insertPos, tr.doc.content.size),
  );
  tr = tr.insert(clampedInsertPos, draggedNode);
  if (clampedInsertPos < tr.doc.content.size) {
    tr = tr.setSelection(NodeSelection.create(tr.doc, clampedInsertPos));
  }
  view.dispatch(tr.scrollIntoView());
  return true;
};

const clearDropPreview = (view: EditorView) => {
  view.dispatch(
    view.state.tr.setMeta(blockDropHighlightKey, {
      pos: null,
      side: "above",
      draggedKind: "none",
      draggedPos: null,
    }),
  );
};

/**
 * Highlights the whole destination block while dragging content in TipTap.
 *
 * Why this exists:
 * - The default drop cursor is a thin insertion line.
 * - For block editing UX (Notion-like), a full-block target is easier to read.
 *
 * How it works:
 * - On `dragstart`, classify drag type (`top-level` or `list-item`).
 * - On `dragover`, resolve the allowed target position based on that drag type.
 * - Expose a `Decoration.node` for that block with `tiptap-drop-target-block` class.
 * - Add drop metadata attributes so CSS can render an insertion box above or below.
 * - On `drop`, move the selected node manually so behavior matches preview side.
 * - Clear the highlight on `dragleave`, `drop`, and `dragend`.
 */
export const BlockDropHighlight = Extension.create({
  name: "blockDropHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<BlockDropHighlightState>({
        key: blockDropHighlightKey,
        state: {
          // Start with no highlighted target.
          init: () => ({
            pos: null,
            side: "above",
            draggedKind: "none",
            draggedPos: null,
            draggedLabel: "Element",
          }),
          apply(tr, oldState) {
            const meta = tr.getMeta(blockDropHighlightKey) as
              | BlockDropHighlightState
              | undefined;

            // Explicit updates from DOM drag handlers win.
            if (meta) {
              return meta;
            }

            if (oldState.pos === null) {
              return oldState;
            }

            // Keep the stored position stable across document changes.
            const mappedPos = tr.mapping.map(oldState.pos);
            const mappedDraggedPos =
              oldState.draggedPos === null
                ? null
                : tr.mapping.map(oldState.draggedPos);

            return {
              ...oldState,
              pos: mappedPos,
              draggedPos: mappedDraggedPos,
            };
          },
        },
        props: {
          decorations(state) {
            const pluginState = blockDropHighlightKey.getState(state);
            if (!pluginState?.pos && pluginState?.pos !== 0) {
              return null;
            }

            const node = state.doc.nodeAt(pluginState.pos);
            if (!node || !node.isBlock) {
              return null;
            }

            const label =
              node.type.name === "listItem"
                ? `- ${pluginState.draggedLabel} will be inserted ${pluginState.side === "above" ? "above" : "below"} this item`
                : `${pluginState.draggedLabel} will be inserted ${pluginState.side === "above" ? "above" : "below"} this block`;

            // Decorate the whole hovered block and expose an insertion label for CSS.
            return DecorationSet.create(state.doc, [
              Decoration.node(
                pluginState.pos,
                pluginState.pos + node.nodeSize,
                {
                  class: "tiptap-drop-target-block",
                  "data-drop-label": label,
                  "data-drop-side": pluginState.side,
                },
              ),
            ]);
          },
          handleDOMEvents: {
            dragstart(view) {
              const dragSource = getDragSourceFromSelection(
                view.state.selection,
                view.state.doc,
              );
              const draggedNode =
                dragSource.draggedPos === null
                  ? inferDraggedNodeFromView(view)
                  : view.state.doc.nodeAt(dragSource.draggedPos);
              const draggedLabel = getDraggedElementLabel(
                draggedNode,
                dragSource.draggedKind,
              );

              view.dispatch(
                view.state.tr.setMeta(blockDropHighlightKey, {
                  pos: null,
                  side: "above",
                  draggedKind: dragSource.draggedKind,
                  draggedPos: dragSource.draggedPos,
                  draggedLabel,
                }),
              );
              return false;
            },
            dragover(view, event) {
              // Convert viewport coords to document position under the cursor.
              const coords = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });

              const currentState = blockDropHighlightKey.getState(view.state);
              const dragSource = inferDragSource(view, currentState);
              const draggedKind = dragSource.draggedKind;

              let draggedPos = dragSource.draggedPos;
              if (draggedPos === null) {
                const fromSelection = getDragSourceFromSelection(
                  view.state.selection,
                  view.state.doc,
                );
                draggedPos = fromSelection.draggedPos;
              }
              if (draggedPos === null) {
                draggedPos = inferDraggedPosFromDom(view, draggedKind);
              }

              if (draggedPos !== null) {
                draggedPos = normalizePosForKind(
                  draggedPos,
                  view.state.doc,
                  draggedKind,
                );
              }

              const draggedNode =
                draggedPos === null
                  ? inferDraggedNodeFromView(view)
                  : view.state.doc.nodeAt(draggedPos);
              const draggedLabel = getDraggedElementLabel(
                draggedNode,
                draggedKind,
              );

              const nextPos = coords
                ? resolveTargetPos(coords.pos, view.state.doc, draggedKind)
                : null;

              let side: "above" | "below" = "above";
              if (nextPos !== null) {
                const blockDom = view.nodeDOM(nextPos);
                if (blockDom instanceof HTMLElement) {
                  const rect = blockDom.getBoundingClientRect();
                  side =
                    event.clientY > rect.top + rect.height / 2
                      ? "below"
                      : "above";
                }
              }

              if (currentState?.pos === nextPos && currentState.side === side) {
                return false;
              }

              // Store hovered block position in plugin state.
              view.dispatch(
                view.state.tr.setMeta(blockDropHighlightKey, {
                  pos: nextPos,
                  side,
                  draggedKind,
                  draggedPos,
                  draggedLabel,
                }),
              );
              return false;
            },
            dragleave(view, event) {
              const related = event.relatedTarget;
              // Ignore leave events while moving between children inside editor.
              if (related instanceof Node && view.dom.contains(related)) {
                return false;
              }

              const currentState = blockDropHighlightKey.getState(view.state);
              if (currentState?.pos !== null) {
                view.dispatch(
                  view.state.tr.setMeta(blockDropHighlightKey, {
                    pos: null,
                    side: "above",
                    draggedKind: currentState?.draggedKind ?? "none",
                    draggedPos: currentState?.draggedPos ?? null,
                    draggedLabel: currentState?.draggedLabel ?? "Element",
                  }),
                );
              }
              return false;
            },
            drop(view, event) {
              const pluginState = blockDropHighlightKey.getState(view.state);

              if (!pluginState || pluginState.draggedKind === "none") {
                return false;
              }

              const fromPos =
                pluginState.draggedPos ??
                (view.state.selection instanceof NodeSelection
                  ? view.state.selection.from
                  : null);

              let handled = false;

              if (pluginState.pos !== null && fromPos !== null) {
                handled = moveBlockByPos(
                  view,
                  fromPos,
                  pluginState.pos,
                  pluginState.side,
                );
              }

              if (handled) {
                // Only cancel native drop if manual move succeeded.
                event.preventDefault();
                clearDropPreview(view);
                return true;
              }

              // Fall back to ProseMirror native drop handling (more robust for tables).
              requestAnimationFrame(() => {
                if (!view.isDestroyed) {
                  clearDropPreview(view);
                }
              });
              return false;
            },
            dragend(view) {
              const current = blockDropHighlightKey.getState(view.state)?.pos;
              if (
                current !== null ||
                blockDropHighlightKey.getState(view.state)?.draggedKind !==
                  "none"
              ) {
                // Clear highlight if drag ends without a drop in this editor.
                view.dispatch(
                  view.state.tr.setMeta(blockDropHighlightKey, {
                    pos: null,
                    side: "above",
                    draggedKind: "none",
                    draggedPos: null,
                    draggedLabel: "Element",
                  }),
                );
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});
