// @vitest-environment jsdom

// The table highlight class must land on the wrapper element that the
// CSS outlines. The table node view renders its rows into an inner
// div, so the class cannot be placed on the row content itself.

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { EditorContent } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TableWithControls } from "./TableControlls/TableControlls";
import {
  EditorContextHighlight,
  setEditorContextHighlight,
} from "./editorContextHighlight";

describe("table highlight decoration", () => {
  it("marks the table node view wrapper", () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        EditorContextHighlight,
        TableRow,
        TableCell,
        TableHeader,
        TableWithControls,
      ],
      content: "<p>hi</p>",
    });
    render(<EditorContent editor={editor} />);
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      let tablePos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "table" && tablePos === -1) tablePos = pos;
      });

      setEditorContextHighlight(editor, tablePos);

      const target = editor.view.dom.querySelector(
        ".editor-context-target-table",
      );
      expect(target).not.toBeNull();
      // The classed wrapper contains the rendered rows.
      expect(
        target?.querySelector("[data-node-view-content-react]"),
      ).not.toBeNull();
    } finally {
      editor.destroy();
    }
  });
});
