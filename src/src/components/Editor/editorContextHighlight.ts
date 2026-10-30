// Highlights the node the user just right-clicked.
//
// A ProseMirror node decoration adds the `editor-context-target` class
// to the rendered node (image, code block or table). The themed editor
// box draws the primary-colour outline for that class. The highlight is
// cleared when the menu closes.

import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const HIGHLIGHT_KEY = new PluginKey<DecorationSet>("editorContextHighlight");
const HIGHLIGHT_META = "editorContextHighlightMeta";

interface HighlightSeed {
  from: number;
}

interface HighlightClear {
  clear: true;
}

export type HighlightMeta = HighlightSeed | HighlightClear;

export const EditorContextHighlight = Extension.create({
  name: "editorContextHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: HIGHLIGHT_KEY,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, value) {
            const meta = tr.getMeta(HIGHLIGHT_META) as
              | HighlightMeta
              | undefined;
            if (meta && "clear" in meta) return DecorationSet.empty;
            if (meta && typeof meta.from === "number") {
              const node = tr.doc.nodeAt(meta.from);
              if (node) {
                return DecorationSet.create(tr.doc, [
                  Decoration.node(
                    meta.from,
                    meta.from + node.nodeSize,
                    { class: "editor-context-target" },
                  ),
                ]);
              }
            }
            return value.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return HIGHLIGHT_KEY.getState(state);
          },
        },
      }),
    ];
  },
});

export function setEditorContextHighlight(editor: Editor, from: number): void {
  const tr = editor.state.tr
    .setMeta(HIGHLIGHT_META, { from })
    .setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}

export function clearEditorContextHighlight(editor: Editor): void {
  const current = HIGHLIGHT_KEY.getState(editor.state);
  if (!current || current.find().length === 0) return;
  editor.view.dispatch(
    editor.state.tr
      .setMeta(HIGHLIGHT_META, { clear: true })
      .setMeta("addToHistory", false),
  );
}
