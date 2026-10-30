// @vitest-environment jsdom

// End-to-end table context menu: right-clicking a cell while the caret
// is collapsed must still offer the table commands.

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { analyseTableAtPos } from "./bubbleMenuStrategies";
import { buildEditorMenuRequest } from "../RightClick/rightClickMenuPresets";
import {
  applyEditorContextTarget,
  resolveEditorContextTarget,
} from "./editorContextTarget";

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit, Table, TableRow, TableHeader, TableCell],
    content: "<p>hi</p>",
  });
}

function findTablePos(editor: Editor): number {
  let pos = -1;
  editor.state.doc.descendants((node, nodePos) => {
    if (node.type.name === "table" && pos === -1) pos = nodePos;
  });
  return pos;
}

describe("analyseTableAtPos", () => {
  it("returns the cell for a collapsed position", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      const analysis = analyseTableAtPos(
        editor.state,
        findTablePos(editor) + 3,
      );
      expect(analysis.kind).toBe("tableCell");
      expect(analysis.cell?.rowIndices).toEqual([0]);
      expect(analysis.cell?.columnIndices).toEqual([0]);
    } finally {
      editor.destroy();
    }
  });
});

describe("editor table context menu", () => {
  it("offers table rows when right-clicking a cell with no selection", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      const hit = findTablePos(editor) + 3;
      editor.view.posAtCoords = () => ({ pos: hit, inside: -1 });

      const target = resolveEditorContextTarget(editor, { x: 1, y: 1 });
      applyEditorContextTarget(editor, target!);
      const request = buildEditorMenuRequest(
        editor,
        true,
        { x: 1, y: 1 },
        target,
      );

      expect(request.leadingComponents?.map((row) => row.label)).toEqual([
        "Delete table",
        "Rows",
        "Columns",
        "Clear cell",
      ]);
    } finally {
      editor.destroy();
    }
  });

  it("keeps table rows when the DOM target is the table itself", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      const hit = findTablePos(editor) + 3;
      editor.view.posAtCoords = () => ({ pos: hit, inside: -1 });
      const table = editor.view.dom.querySelector("table")!;

      const target = resolveEditorContextTarget(editor, { x: 1, y: 1 }, table);
      const request = buildEditorMenuRequest(
        editor,
        true,
        { x: 1, y: 1 },
        target,
      );

      expect(request.leadingComponents?.map((row) => row.label)).toEqual([
        "Delete table",
        "Rows",
        "Columns",
        "Clear cell",
      ]);
    } finally {
      editor.destroy();
    }
  });
});
