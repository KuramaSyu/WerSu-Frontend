import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Internal plugin state.
 * `pos` stores the start position of the block currently hovered during drag.
 */
interface BlockDropHighlightState {
  pos: number | null;
}

const blockDropHighlightKey = new PluginKey<BlockDropHighlightState>(
  "blockDropHighlight",
);

/**
 * Resolve the nearest block-level node start position for a document position.
 *
 * We walk up the resolved position depth until we find a block node,
 * then return that block's start position so we can decorate the entire block.
 */
const findBlockPos = (
  docPos: number,
  stateDoc: ProseMirrorNode,
): number | null => {
  const $pos = stateDoc.resolve(docPos);

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.isBlock) {
      return $pos.before(depth);
    }
  }

  return null;
};

/**
 * Highlights the whole destination block while dragging content in TipTap.
 *
 * Why this exists:
 * - The default drop cursor is a thin insertion line.
 * - For block editing UX (Notion-like), a full-block target is easier to read.
 *
 * How it works:
 * - On `dragover`, store the hovered block start position in plugin state.
 * - Expose a `Decoration.node` for that block with `tiptap-drop-target-block` class.
 * - Add a drop-label attribute that CSS renders above the block without reflow.
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
          init: () => ({ pos: null }),
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
            return { pos: mappedPos };
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
                ? "- Element will be inserted here"
                : "Element will be inserted here";

            // Decorate the whole hovered block and expose an insertion label for CSS.
            return DecorationSet.create(state.doc, [
              Decoration.node(
                pluginState.pos,
                pluginState.pos + node.nodeSize,
                {
                  class: "tiptap-drop-target-block",
                  "data-drop-label": label,
                },
              ),
            ]);
          },
          handleDOMEvents: {
            dragover(view, event) {
              // Convert viewport coords to document position under the cursor.
              const coords = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });

              const nextPos = coords
                ? findBlockPos(coords.pos, view.state.doc)
                : null;
              const current = blockDropHighlightKey.getState(view.state)?.pos;

              if (current === nextPos) {
                return false;
              }

              // Store hovered block position in plugin state.
              view.dispatch(
                view.state.tr.setMeta(blockDropHighlightKey, { pos: nextPos }),
              );
              return false;
            },
            dragleave(view, event) {
              const related = event.relatedTarget;
              // Ignore leave events while moving between children inside editor.
              if (related instanceof Node && view.dom.contains(related)) {
                return false;
              }

              const current = blockDropHighlightKey.getState(view.state)?.pos;
              if (current !== null) {
                view.dispatch(
                  view.state.tr.setMeta(blockDropHighlightKey, { pos: null }),
                );
              }
              return false;
            },
            drop(view) {
              const current = blockDropHighlightKey.getState(view.state)?.pos;
              if (current !== null) {
                // Clear highlight after the drop is completed.
                view.dispatch(
                  view.state.tr.setMeta(blockDropHighlightKey, { pos: null }),
                );
              }
              return false;
            },
            dragend(view) {
              const current = blockDropHighlightKey.getState(view.state)?.pos;
              if (current !== null) {
                // Clear highlight if drag ends without a drop in this editor.
                view.dispatch(
                  view.state.tr.setMeta(blockDropHighlightKey, { pos: null }),
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
