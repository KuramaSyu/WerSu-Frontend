// Tier 1 tests for the right-rail formatting panel context registry.
// Verifies that the most specific context is picked for each selection
// shape so the panel can swap its tool cluster.

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { pickFormattingContext } from "./formattingPanelControls";

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit, Image, Table, TableRow, TableHeader, TableCell],
  });
}

function selectImage(editor: Editor): void {
  editor.commands.insertContent({
    type: "image",
    attrs: { src: "http://x/a.png" },
  });
  let pos = -1;
  editor.state.doc.descendants((node, nodePos) => {
    if (node.type.name === "image") pos = nodePos;
    return true;
  });
  editor.commands.setNodeSelection(pos);
}

describe("pickFormattingContext", () => {
  it("returns null for a plain paragraph selection", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello</p>");
      editor.commands.setTextSelection(2);
      expect(pickFormattingContext(editor)).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("picks 'image' for a selected image", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello</p>");
      selectImage(editor);
      expect(pickFormattingContext(editor)?.id).toBe("image");
    } finally {
      editor.destroy();
    }
  });

  it("picks 'table' when the cursor is inside a table", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello</p>");
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      expect(pickFormattingContext(editor)?.id).toBe("table");
    } finally {
      editor.destroy();
    }
  });

  it("picks 'codeBlock' when the cursor is inside a code block", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello</p>");
      editor.commands.toggleCodeBlock();
      expect(pickFormattingContext(editor)?.id).toBe("codeBlock");
    } finally {
      editor.destroy();
    }
  });

  it("picks 'list' when the cursor is inside a bullet list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello</p>");
      editor.commands.toggleBulletList();
      expect(pickFormattingContext(editor)?.id).toBe("list");
    } finally {
      editor.destroy();
    }
  });

  it("prefers the image context over a surrounding table", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello</p>");
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      selectImage(editor);
      expect(pickFormattingContext(editor)?.id).toBe("image");
    } finally {
      editor.destroy();
    }
  });

  it("picks 'blockquote' when the cursor is inside a quote", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<blockquote><p>quoted</p></blockquote>",
      );
      editor.commands.setTextSelection(3);
      expect(pickFormattingContext(editor)?.id).toBe("blockquote");
    } finally {
      editor.destroy();
    }
  });

  it("prefers the list context over a surrounding quote", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<blockquote><ul><li><p>one</p></li></ul></blockquote>",
      );
      let pos = -1;
      editor.state.doc.descendants((node, nodePos) => {
        if (node.isTextblock && node.textContent === "one") pos = nodePos;
        return true;
      });
      editor.commands.setTextSelection(pos + 1);
      expect(pickFormattingContext(editor)?.id).toBe("list");
    } finally {
      editor.destroy();
    }
  });
});
