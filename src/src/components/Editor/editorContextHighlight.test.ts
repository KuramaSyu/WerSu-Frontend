// @vitest-environment jsdom

// Highlight decoration: setting marks the clicked node, clearing
// removes it, and unrelated transactions keep it mapped.

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import type { DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import {
  clearEditorContextHighlight,
  EditorContextHighlight,
  setEditorContextHighlight,
} from "./editorContextHighlight";

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit, EditorContextHighlight],
    content: "<p>hello</p><p>world</p>",
  });
}

function decorationCount(editor: Editor): number {
  const set = editor.view.someProp("decorations", (f) =>
    f(editor.state),
  ) as DecorationSet | null | undefined;
  return set ? set.find().length : 0;
}

describe("EditorContextHighlight", () => {
  it("marks the node at the given position", () => {
    const editor = makeEditor();
    try {
      expect(decorationCount(editor)).toBe(0);
      setEditorContextHighlight(editor, 0);
      expect(decorationCount(editor)).toBe(1);
    } finally {
      editor.destroy();
    }
  });

  it("clears the mark", () => {
    const editor = makeEditor();
    try {
      setEditorContextHighlight(editor, 0);
      clearEditorContextHighlight(editor);
      expect(decorationCount(editor)).toBe(0);
    } finally {
      editor.destroy();
    }
  });

  it("keeps the mark mapped across unrelated transactions", () => {
    const editor = makeEditor();
    try {
      setEditorContextHighlight(editor, 0);
      editor.commands.insertContentAt(8, "!");
      expect(decorationCount(editor)).toBe(1);
    } finally {
      editor.destroy();
    }
  });
});
