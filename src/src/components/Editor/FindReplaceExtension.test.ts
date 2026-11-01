// @vitest-environment jsdom

// Find/replace ProseMirror plugin: match resolution across blocks and
// inline marks, decoration rendering, active index clamping and
// clearing. The React widget is not exercised here.

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { DecorationSet } from "@tiptap/pm/view";
import {
  clearFindReplaceState,
  findDocumentMatches,
  FindReplaceExtension,
  getFindReplaceState,
  setFindReplaceState,
} from "./FindReplaceExtension";
import { DEFAULT_FIND_REPLACE_OPTIONS } from "./findReplace";

function makeEditor(content: string): Editor {
  return new Editor({
    extensions: [StarterKit, FindReplaceExtension],
    content,
  });
}

function decorationCount(editor: Editor): number {
  const set = editor.view.someProp("decorations", (f) =>
    f(editor.state),
  ) as DecorationSet | null | undefined;
  return set ? set.find().length : 0;
}

describe("FindReplaceExtension", () => {
  it("finds matches across blocks", () => {
    const editor = makeEditor("<p>foo bar</p><p>foo baz</p>");
    try {
      const matches = findDocumentMatches(
        editor.state.doc,
        "foo",
        DEFAULT_FIND_REPLACE_OPTIONS,
      );
      expect(matches).toHaveLength(2);
      expect(matches[0].text).toBe("foo");
    } finally {
      editor.destroy();
    }
  });

  it("finds a term split by an inline mark", () => {
    const editor = makeEditor("<p>fo<b>o</b>bar</p>");
    try {
      const matches = findDocumentMatches(
        editor.state.doc,
        "foobar",
        DEFAULT_FIND_REPLACE_OPTIONS,
      );
      expect(matches).toHaveLength(1);
    } finally {
      editor.destroy();
    }
  });

  it("does not match across paragraphs", () => {
    const editor = makeEditor("<p>foo</p><p>bar</p>");
    try {
      const matches = findDocumentMatches(
        editor.state.doc,
        "foobar",
        DEFAULT_FIND_REPLACE_OPTIONS,
      );
      expect(matches).toHaveLength(0);
    } finally {
      editor.destroy();
    }
  });

  it("paints one decoration per match and marks the active one", () => {
    const editor = makeEditor("<p>foo foo</p>");
    try {
      setFindReplaceState(editor, {
        query: "foo",
        options: DEFAULT_FIND_REPLACE_OPTIONS,
        activeIndex: 1,
      });
      expect(decorationCount(editor)).toBe(2);
      expect(getFindReplaceState(editor)?.activeIndex).toBe(1);
    } finally {
      editor.destroy();
    }
  });

  it("recomputes matches when the document changes", () => {
    const editor = makeEditor("<p>foo</p>");
    try {
      setFindReplaceState(editor, {
        query: "foo",
        options: DEFAULT_FIND_REPLACE_OPTIONS,
        activeIndex: 0,
      });
      expect(getFindReplaceState(editor)?.matches).toHaveLength(1);
      editor.commands.insertContent("foo");
      expect(getFindReplaceState(editor)?.matches).toHaveLength(2);
    } finally {
      editor.destroy();
    }
  });

  it("clears state and decorations", () => {
    const editor = makeEditor("<p>foo</p>");
    try {
      setFindReplaceState(editor, {
        query: "foo",
        options: DEFAULT_FIND_REPLACE_OPTIONS,
        activeIndex: 0,
      });
      expect(decorationCount(editor)).toBe(1);
      clearFindReplaceState(editor);
      expect(decorationCount(editor)).toBe(0);
      expect(getFindReplaceState(editor)?.matches).toEqual([]);
    } finally {
      editor.destroy();
    }
  });
});
