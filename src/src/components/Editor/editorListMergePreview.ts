// Hover preview for the list-item merge action.
//
// While the user hovers the merge button in the formatting panel, two
// node decorations tint the bullets that would be joined: the surviving
// bullet (primary) and the consumed one (secondary). A widget placed on
// the seam between them renders a merge glyph so the result is obvious
// before the click.

import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { ListMergePreview } from "./listElementOperations";

const MERGE_PREVIEW_KEY = new PluginKey<DecorationSet>(
  "editorListMergePreview",
);
const MERGE_PREVIEW_META = "editorListMergePreviewMeta";

interface MergePreviewMeta {
  preview: ListMergePreview | null;
}

const MERGE_SYMBOL_PATH =
  "M17 20.41L18.41 19 15 15.59 13.59 17 17 20.41zM7.5 8H11v5.59L5.59 19 7 20.41l6-6V8h3.5L12 3.5 7.5 8z";

function createMergeSymbol(): HTMLElement {
  const wrapper = document.createElement("span");
  wrapper.className = "editor-list-merge-symbol";
  wrapper.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("d", MERGE_SYMBOL_PATH);

  svg.appendChild(path);
  wrapper.appendChild(svg);
  return wrapper;
}

export const EditorListMergePreview = Extension.create({
  name: "editorListMergePreview",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: MERGE_PREVIEW_KEY,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, value) {
            const meta = tr.getMeta(MERGE_PREVIEW_META) as
              | MergePreviewMeta
              | undefined;
            if (meta !== undefined) {
              const preview = meta.preview;
              if (!preview) return DecorationSet.empty;
              // The lower bullet starts at the seam between the two.
              const seam = Math.max(
                preview.primaryFrom,
                preview.secondaryFrom,
              );
              return DecorationSet.create(tr.doc, [
                Decoration.node(preview.primaryFrom, preview.primaryTo, {
                  class: "editor-list-merge-primary",
                }),
                Decoration.node(preview.secondaryFrom, preview.secondaryTo, {
                  class: "editor-list-merge-secondary",
                }),
                Decoration.widget(seam, createMergeSymbol, { side: 1 }),
              ]);
            }
            return value.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return MERGE_PREVIEW_KEY.getState(state);
          },
        },
      }),
    ];
  },
});

export function showListMergePreview(
  editor: Editor,
  preview: ListMergePreview,
): void {
  editor.view.dispatch(
    editor.state.tr
      .setMeta(MERGE_PREVIEW_META, { preview })
      .setMeta("addToHistory", false),
  );
}

export function clearListMergePreview(editor: Editor): void {
  const current = MERGE_PREVIEW_KEY.getState(editor.state);
  if (!current || current.find().length === 0) return;
  editor.view.dispatch(
    editor.state.tr
      .setMeta(MERGE_PREVIEW_META, { preview: null })
      .setMeta("addToHistory", false),
  );
}
