// Tests for the list merge hover preview decorations.

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  EditorListMergePreview,
  clearListMergePreview,
  showListMergePreview,
} from "./editorListMergePreview";
import { getListElementMergePreview } from "./listElementOperations";

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit, EditorListMergePreview],
  });
}

function setListContent(editor: Editor, texts: string[]): void {
  editor.commands.setContent({
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: texts.map((text) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text }],
            },
          ],
        })),
      },
    ],
  } as never);
}

function selectText(editor: Editor, text: string): void {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent === text) found = pos;
    return true;
  });
  editor.commands.setTextSelection(found + 1);
}

function showPreview(editor: Editor): void {
  const preview = getListElementMergePreview(editor.state);
  if (!preview) throw new Error("expected a merge preview");
  showListMergePreview(editor, preview);
}

describe("EditorListMergePreview", () => {
  it("marks the survivor and the consumed bullet", () => {
    const editor = makeEditor();
    try {
      setListContent(editor, ["a", "b"]);
      selectText(editor, "a");
      showPreview(editor);
      const primary = editor.view.dom.querySelector(
        ".editor-list-merge-primary",
      );
      const secondary = editor.view.dom.querySelector(
        ".editor-list-merge-secondary",
      );
      expect(primary?.textContent).toBe("a");
      expect(secondary?.textContent).toBe("b");
    } finally {
      editor.destroy();
    }
  });

  it("renders a single merge glyph between the bullets", () => {
    const editor = makeEditor();
    try {
      setListContent(editor, ["a", "b"]);
      selectText(editor, "a");
      showPreview(editor);
      expect(
        editor.view.dom.querySelectorAll(".editor-list-merge-symbol").length,
      ).toBe(1);
    } finally {
      editor.destroy();
    }
  });

  it("clears the decorations on request", () => {
    const editor = makeEditor();
    try {
      setListContent(editor, ["a", "b"]);
      selectText(editor, "a");
      showPreview(editor);
      clearListMergePreview(editor);
      expect(
        editor.view.dom.querySelector(".editor-list-merge-primary"),
      ).toBeNull();
      expect(
        editor.view.dom.querySelector(".editor-list-merge-symbol"),
      ).toBeNull();
    } finally {
      editor.destroy();
    }
  });
});
