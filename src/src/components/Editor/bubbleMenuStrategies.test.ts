// Tier 1 tests for the bubble-menu strategy pattern.
//
// The strategy pattern splits selection -> button list into two
// pure functions:
//   * `analyseSelection(state)` -> a typed `SelectionAnalysis`
//     that captures where the selection lives.
//   * `pickStrategy(analysis)` -> a strategy object whose
//     `build(analysis, editor)` returns the list of ops to
//     render.
// We test both with a real Tiptap editor and a real
// CellSelection (so `forEachCell` matches production behaviour)
// but no DOM / no MUI. That gives us confidence the analysis
// classifies every selection kind correctly and each strategy
// returns the right op shape.

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import {
  analyseSelection,
  pickStrategy,
  type BubbleMenuOp,
} from "./bubbleMenuStrategies";

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit, Table, TableRow, TableHeader, TableCell],
  });
}

/** Build a 3x3 table by inserting a 3x3 table directly. We use
 *  `insertTable` rather than `setContent(html)` because the
 *  latter goes through a generic DOM parser that can miss the
 *  table's role metadata -- the `CellSelection` constructor
 *  reads it and crashes with "Not a table node" otherwise. */
function buildThreeByThreeTable(): Editor {
  const editor = makeEditor();
  editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
  return editor;
}

/** Find the document position of cell `(row, col)` in the
 *  first table. Tiptap's `setCellSelection` takes *document
 *  positions*, not cell indices, so we walk the table map
 *  ourselves to convert row/col pairs into the positions
 *  `CellSelection.create` expects. */
function cellPos(editor: Editor, row: number, col: number): number {
  const tablePos = findFirstTablePos(editor);
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table) throw new Error("no table");
  const map = TableMap.get(table);
  return tablePos + 1 + map.positionAt(row, col, table);
}

function findFirstTablePos(editor: Editor): number {
  let pos = 0;
  editor.state.doc.descendants((node, p) => {
    if (node.type.name === "table" && pos === 0) {
      pos = p;
      return false;
    }
    return true;
  });
  return pos;
}

/** Install a `CellSelection` between two cells given as
 *  (row, col) pairs. Mirrors the production behaviour the
 *  bubble menu will see when the user clicks and drags across
 *  a row / column / block. */
function selectCells(
  editor: Editor,
  anchor: { row: number; col: number },
  head: { row: number; col: number } = anchor,
): void {
  const anchorPos = cellPos(editor, anchor.row, anchor.col);
  const headPos = cellPos(editor, head.row, head.col);
  const sel = CellSelection.create(editor.state.doc, anchorPos, headPos);
  editor.view.dispatch(editor.state.tr.setSelection(sel));
}

describe("analyseSelection", () => {
  it("returns 'empty' for a collapsed cursor", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hi</p>");
      editor.commands.focus("end");
      const analysis = analyseSelection(editor.state);
      expect(analysis.kind).toBe("empty");
    } finally {
      editor.destroy();
    }
  });

  it("returns 'text' for a normal text selection", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello world</p>");
      editor.commands.setTextSelection({ from: 2, to: 5 });
      const analysis = analyseSelection(editor.state);
      expect(analysis.kind).toBe("text");
    } finally {
      editor.destroy();
    }
  });

  it("returns 'tableRow' for a full single row in a 3x3 table", () => {
    const editor = buildThreeByThreeTable();
    try {
      selectCells(editor, { row: 0, col: 0 }, { row: 0, col: 2 });
      const analysis = analyseSelection(editor.state);
      expect(analysis.kind).toBe("tableRow");
      expect(analysis.cell?.rowIndices).toEqual([0]);
      expect(analysis.cell?.columnIndices).toEqual([0, 1, 2]);
    } finally {
      editor.destroy();
    }
  });

  it("returns 'tableColumn' for a full single column in a 2x2 table", () => {
    // A 2x2 table gives us a column selection that is not also
    // a full row, so the analysis picks "tableColumn" over
    // "tableRow".
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      // Cells (0,0) and (1,0) -> column 0.
      selectCells(editor, { row: 0, col: 0 }, { row: 1, col: 0 });
      const analysis = analyseSelection(editor.state);
      expect(analysis.kind).toBe("tableColumn");
      expect(analysis.cell?.columnIndices).toEqual([0]);
      expect(analysis.cell?.rowIndices).toEqual([0, 1]);
    } finally {
      editor.destroy();
    }
  });

  it("returns 'tableBlock' for a rectangular multi-row + multi-col selection", () => {
    const editor = buildThreeByThreeTable();
    try {
      // Cells 0, 1, 3, 4 -> rows 0-1, cols 0-1. The selection
      // is rectangular but not a single full row or column.
      selectCells(editor, { row: 0, col: 0 }, { row: 1, col: 1 });
      const analysis = analyseSelection(editor.state);
      expect(analysis.kind).toBe("tableBlock");
      expect(analysis.cell?.rowIndices).toEqual([0, 1]);
      expect(analysis.cell?.columnIndices).toEqual([0, 1]);
    } finally {
      editor.destroy();
    }
  });

  it("returns 'tableWhole' when every cell in the table is selected", () => {
    const editor = buildThreeByThreeTable();
    try {
      // Select every cell in the 3x3 table.
      selectCells(editor, { row: 0, col: 0 }, { row: 2, col: 2 });
      const analysis = analyseSelection(editor.state);
      expect(analysis.kind).toBe("tableWhole");
      // The cell context still carries the full row/col index
      // list so the strategy's icon/label decisions can read
      // from it.
      expect(analysis.cell?.rowIndices).toEqual([0, 1, 2]);
      expect(analysis.cell?.columnIndices).toEqual([0, 1, 2]);
    } finally {
      editor.destroy();
    }
  });

  it("returns 'multiTable' for a selection that crosses table boundaries", () => {
    // Build an editor with two tables and a paragraph between
    // them; a text selection that starts in the first table and
    // ends in the second spans multiple tables.
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 1, cols: 2, withHeaderRow: false });
      editor.commands.insertContent("<p>x</p>");
      editor.commands.insertTable({ rows: 1, cols: 2, withHeaderRow: false });
      const docSize = editor.state.doc.content.size;
      const fromPos = 1 + 2; // first cell of first table
      const toPos = docSize - 2; // inside table B
      editor.commands.setTextSelection({ from: fromPos, to: toPos });
      const analysis = analyseSelection(editor.state);
      expect(analysis.kind).toBe("multiTable");
    } finally {
      editor.destroy();
    }
  });
});

describe("pickStrategy", () => {
  it("returns the row strategy for a full row", () => {
    const editor = buildThreeByThreeTable();
    try {
      selectCells(editor, { row: 0, col: 0 }, { row: 0, col: 2 });
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      expect(strategy.name).toBe("table-row");
    } finally {
      editor.destroy();
    }
  });

  it("returns the column strategy for a full column", () => {
    // 2x2 so the column selection is not also a full row.
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      selectCells(editor, { row: 0, col: 0 }, { row: 1, col: 0 });
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      expect(strategy.name).toBe("table-column");
    } finally {
      editor.destroy();
    }
  });

  it("returns the cell strategy for a partial / block cell selection", () => {
    const editor = buildThreeByThreeTable();
    try {
      selectCells(editor, { row: 0, col: 0 }, { row: 1, col: 1 });
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      expect(strategy.name).toBe("table-cell");
    } finally {
      editor.destroy();
    }
  });

  it("returns the whole-table strategy for a full table selection", () => {
    const editor = buildThreeByThreeTable();
    try {
      selectCells(editor, { row: 0, col: 0 }, { row: 2, col: 2 });
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      expect(strategy.name).toBe("table-whole");
    } finally {
      editor.destroy();
    }
  });

  it("returns the cell strategy for a text selection inside a cell (in-table)", () => {
    // No CellSelection -- just a regular text selection that
    // happens to live inside a table cell. The cell strategy's
    // `matches` predicate picks it up via `(a.kind === 'text'
    // && !!a.cell)`.
    const editor = buildThreeByThreeTable();
    try {
      // Type something into the first cell so we can pick a
      // non-empty text range. The cell's default text is
      // empty, so we insert content first and then select.
      const cellStart = cellPos(editor, 0, 0);
      // Tiptap's `insertContentAt` respects the cell's
      // content (a paragraph) and slots the text in.
      editor.commands.setTextSelection(cellStart + 1);
      editor.commands.insertContent("hi");
      // After inserting "hi", the cell content runs from
      // cellStart + 1 to cellStart + 3. Select the whole text.
      editor.commands.setTextSelection({
        from: cellStart + 1,
        to: cellStart + 3,
      });
      const analysis = analyseSelection(editor.state);
      expect(analysis.kind).toBe("text");
      expect(analysis.cell).toBeDefined();
      const strategy = pickStrategy(analysis);
      expect(strategy.name).toBe("table-cell");
    } finally {
      editor.destroy();
    }
  });

  it("returns the text strategy for an out-of-table selection", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello world</p>");
      editor.commands.setTextSelection({ from: 2, to: 5 });
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      expect(strategy.name).toBe("text");
    } finally {
      editor.destroy();
    }
  });

  it("returns the text strategy for multi-table selections (table rules do not apply)", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 1, cols: 2, withHeaderRow: false });
      editor.commands.insertContent("<p>x</p>");
      editor.commands.insertTable({ rows: 1, cols: 2, withHeaderRow: false });
      const docSize = editor.state.doc.content.size;
      const fromPos = 1 + 2;
      const toPos = docSize - 2;
      editor.commands.setTextSelection({ from: fromPos, to: toPos });
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      expect(strategy.name).toBe("text");
    } finally {
      editor.destroy();
    }
  });
});

describe("row strategy ops", () => {
  it("starts with add-row ops, then move, then delete", () => {
    const editor = buildThreeByThreeTable();
    try {
      selectCells(editor, { row: 0, col: 0 }, { row: 0, col: 2 });
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      const ops = strategy.build(analysis, editor);
      const ids = ops.filter(opIsAction).map((o) => o.id);
      expect(ids[0]).toBe("add-row-before");
      expect(ids[1]).toBe("add-row-after");
      expect(ids).toContain("move-row-up");
      expect(ids).toContain("move-row-down");
      expect(ids).toContain("delete-row");
    } finally {
      editor.destroy();
    }
  });

  it("singular 'Delete row' for a single-row selection, plural 'Delete rows' for multi", () => {
    const editor = buildThreeByThreeTable();
    try {
      // Single row: row 0, all columns.
      selectCells(editor, { row: 0, col: 0 }, { row: 0, col: 2 });
      const single = pickStrategy(analyseSelection(editor.state)).build(
        analyseSelection(editor.state),
        editor,
      );
      const singleDelete = single.find(
        (o) => o.kind === "action" && o.id === "delete-row",
      );
      expect(
        singleDelete && "label" in singleDelete ? singleDelete.label : "",
      ).toBe("Delete row");

      // Multi row: rows 0 and 1, all columns. Build the
      // selection as a row band via `CellSelection.rowSelection`,
      // which expands the anchor + head into the full row
      // range, so the analysis picks `tableRow` (not
      // `tableBlock`).
      const a = editor.state.doc.resolve(cellPos(editor, 0, 0));
      const b = editor.state.doc.resolve(cellPos(editor, 1, 0));
      const sel = CellSelection.rowSelection(a, b);
      editor.view.dispatch(editor.state.tr.setSelection(sel));
      const analysisMulti = analyseSelection(editor.state);
      expect(analysisMulti.kind).toBe("tableRow");
      const multiOps = pickStrategy(analysisMulti).build(analysisMulti, editor);
      const multiDelete = multiOps.find(
        (o) => o.kind === "action" && o.id === "delete-row",
      );
      expect(
        multiDelete && "label" in multiDelete ? multiDelete.label : "",
      ).toBe("Delete rows");
    } finally {
      editor.destroy();
    }
  });

  it("row ops use the dedicated Tabler icon names", () => {
    const editor = buildThreeByThreeTable();
    try {
      selectCells(editor, { row: 0, col: 0 }, { row: 0, col: 2 });
      const ops = pickStrategy(analyseSelection(editor.state)).build(
        analyseSelection(editor.state),
        editor,
      );
      const icons = Object.fromEntries(
        ops
          .filter(
            (o): o is Extract<BubbleMenuOp, { kind: "action" }> =>
              o.kind === "action",
          )
          .map((o) => [o.id, o.icon]),
      );
      expect(icons["add-row-before"]).toBe("row-insert-top");
      expect(icons["add-row-after"]).toBe("row-insert-bottom");
      expect(icons["move-row-up"]).toBe("row-move-up");
      expect(icons["move-row-down"]).toBe("row-move-down");
      expect(icons["delete-row"]).toBe("row-remove");
    } finally {
      editor.destroy();
    }
  });
});

describe("row move", () => {
  it("move-row-down swaps the selected row with the row below it", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
      // Insert distinct text into cell (0,0) and (1,0) so we
      // can verify the swap.
      editor.commands.setTextSelection(cellPos(editor, 0, 0) + 1);
      editor.commands.insertContent("A1");
      editor.commands.setTextSelection(cellPos(editor, 1, 0) + 1);
      editor.commands.insertContent("B1");

      // Select row 0 (all 3 cells).
      selectCells(editor, { row: 0, col: 0 }, { row: 0, col: 2 });
      const analysis = analyseSelection(editor.state);
      const moveDown = pickStrategy(analysis)
        .build(analysis, editor)
        .find(
          (o): o is Extract<BubbleMenuOp, { kind: "action" }> =>
            o.kind === "action" && o.id === "move-row-down",
        );
      expect(moveDown).toBeDefined();
      moveDown!.run(editor);

      // After the swap, row 0 has the original row 1 content
      // ("B1" in cell 0) and row 1 has the original row 0
      // content ("A1" in cell 0).
      const table = editor.state.doc.firstChild!;
      expect(table.child(0).firstChild!.textContent).toBe("B1");
      expect(table.child(1).firstChild!.textContent).toBe("A1");
    } finally {
      editor.destroy();
    }
  });

  it("move-row-up swaps the selected row with the row above it", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
      editor.commands.setTextSelection(cellPos(editor, 0, 0) + 1);
      editor.commands.insertContent("A1");
      editor.commands.setTextSelection(cellPos(editor, 1, 0) + 1);
      editor.commands.insertContent("B1");

      // Select row 1 and move it up.
      selectCells(editor, { row: 1, col: 0 }, { row: 1, col: 2 });
      const analysis = analyseSelection(editor.state);
      const moveUp = pickStrategy(analysis)
        .build(analysis, editor)
        .find(
          (o): o is Extract<BubbleMenuOp, { kind: "action" }> =>
            o.kind === "action" && o.id === "move-row-up",
        );
      expect(moveUp).toBeDefined();
      moveUp!.run(editor);

      const table = editor.state.doc.firstChild!;
      expect(table.child(0).firstChild!.textContent).toBe("B1");
      expect(table.child(1).firstChild!.textContent).toBe("A1");
    } finally {
      editor.destroy();
    }
  });

  it("move-row-down is a no-op when the row is already at the bottom", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
      editor.commands.setTextSelection(cellPos(editor, 2, 0) + 1);
      editor.commands.insertContent("last");

      // Select the last row.
      selectCells(editor, { row: 2, col: 0 }, { row: 2, col: 2 });
      const analysis = analyseSelection(editor.state);
      const moveDown = pickStrategy(analysis)
        .build(analysis, editor)
        .find(
          (o): o is Extract<BubbleMenuOp, { kind: "action" }> =>
            o.kind === "action" && o.id === "move-row-down",
        );
      moveDown!.run(editor);

      // Doc unchanged.
      const table = editor.state.doc.firstChild!;
      expect(table.child(2).firstChild!.textContent).toBe("last");
    } finally {
      editor.destroy();
    }
  });
});

describe("column strategy ops", () => {
  it("starts with add-column ops, then move, then delete", () => {
    // 2x2 so the column selection is *not* also a full row.
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      selectCells(editor, { row: 0, col: 0 }, { row: 1, col: 0 });
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      const ops = strategy.build(analysis, editor);
      const ids = ops.filter(opIsAction).map((o) => o.id);
      expect(ids[0]).toBe("add-column-before");
      expect(ids[1]).toBe("add-column-after");
      expect(ids).toContain("move-column-left");
      expect(ids).toContain("move-column-right");
      expect(ids).toContain("delete-column");
    } finally {
      editor.destroy();
    }
  });

  it("singular 'Delete column' for a single-column selection, plural 'Delete columns' for multi", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
      // Single column: col 0.
      selectCells(editor, { row: 0, col: 0 }, { row: 2, col: 0 });
      const single = pickStrategy(analyseSelection(editor.state)).build(
        analyseSelection(editor.state),
        editor,
      );
      const singleDelete = single.find(
        (o) => o.kind === "action" && o.id === "delete-column",
      );
      expect(
        singleDelete && "label" in singleDelete ? singleDelete.label : "",
      ).toBe("Delete column");

      // Multi column: cols 0 and 1, all rows. Build via
      // `CellSelection.colSelection` so the analysis picks
      // `tableColumn` (not `tableBlock`).
      const a = editor.state.doc.resolve(cellPos(editor, 0, 0));
      const b = editor.state.doc.resolve(cellPos(editor, 0, 1));
      const sel = CellSelection.colSelection(a, b);
      editor.view.dispatch(editor.state.tr.setSelection(sel));
      const analysisMulti = analyseSelection(editor.state);
      expect(analysisMulti.kind).toBe("tableColumn");
      const multiOps = pickStrategy(analysisMulti).build(analysisMulti, editor);
      const multiDelete = multiOps.find(
        (o) => o.kind === "action" && o.id === "delete-column",
      );
      expect(
        multiDelete && "label" in multiDelete ? multiDelete.label : "",
      ).toBe("Delete columns");
    } finally {
      editor.destroy();
    }
  });

  it("column ops use the dedicated Tabler icon names", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
      selectCells(editor, { row: 0, col: 0 }, { row: 2, col: 0 });
      const ops = pickStrategy(analyseSelection(editor.state)).build(
        analyseSelection(editor.state),
        editor,
      );
      const icons = Object.fromEntries(
        ops
          .filter(
            (o): o is Extract<BubbleMenuOp, { kind: "action" }> =>
              o.kind === "action",
          )
          .map((o) => [o.id, o.icon]),
      );
      expect(icons["add-column-before"]).toBe("column-insert-left");
      expect(icons["add-column-after"]).toBe("column-insert-right");
      expect(icons["move-column-left"]).toBe("column-move-left");
      expect(icons["move-column-right"]).toBe("column-move-right");
      expect(icons["delete-column"]).toBe("column-remove");
    } finally {
      editor.destroy();
    }
  });
});

describe("column move", () => {
  it("move-column-right swaps the selected column with the one to its right", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
      // Insert distinct text in column 0 of two rows so we
      // can verify the swap.
      editor.commands.setTextSelection(cellPos(editor, 0, 0) + 1);
      editor.commands.insertContent("A1");
      editor.commands.setTextSelection(cellPos(editor, 0, 1) + 1);
      editor.commands.insertContent("B1");

      // Select column 0 (all 3 rows).
      selectCells(editor, { row: 0, col: 0 }, { row: 2, col: 0 });
      const analysis = analyseSelection(editor.state);
      const moveRight = pickStrategy(analysis)
        .build(analysis, editor)
        .find(
          (o): o is Extract<BubbleMenuOp, { kind: "action" }> =>
            o.kind === "action" && o.id === "move-column-right",
        );
      expect(moveRight).toBeDefined();
      moveRight!.run(editor);

      // After the swap, column 0 of row 0 has the original
      // column 1's text ("B1") and column 1 has "A1".
      const table = editor.state.doc.firstChild!;
      const row0 = table.child(0);
      expect(row0.child(0).textContent).toBe("B1");
      expect(row0.child(1).textContent).toBe("A1");
    } finally {
      editor.destroy();
    }
  });

  it("move-column-left swaps the selected column with the one to its left", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });
      editor.commands.setTextSelection(cellPos(editor, 0, 0) + 1);
      editor.commands.insertContent("A1");
      editor.commands.setTextSelection(cellPos(editor, 0, 1) + 1);
      editor.commands.insertContent("B1");

      selectCells(editor, { row: 0, col: 1 }, { row: 2, col: 1 });
      const analysis = analyseSelection(editor.state);
      const moveLeft = pickStrategy(analysis)
        .build(analysis, editor)
        .find(
          (o): o is Extract<BubbleMenuOp, { kind: "action" }> =>
            o.kind === "action" && o.id === "move-column-left",
        );
      expect(moveLeft).toBeDefined();
      moveLeft!.run(editor);

      const table = editor.state.doc.firstChild!;
      const row0 = table.child(0);
      expect(row0.child(0).textContent).toBe("B1");
      expect(row0.child(1).textContent).toBe("A1");
    } finally {
      editor.destroy();
    }
  });
});

describe("whole-table strategy ops", () => {
  it("emits only a delete-table action", () => {
    const editor = buildThreeByThreeTable();
    try {
      selectCells(editor, { row: 0, col: 0 }, { row: 2, col: 2 });
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      const ops = strategy.build(analysis, editor);
      const actions = ops.filter(opIsAction);
      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe("delete-table");
      expect(actions[0].icon).toBe("table-remove");
      // No formatting toggles -- the whole-table menu only
      // shows the destructive action.
      expect(ops.some((o) => o.kind === "toggle")).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});

describe("unified row/column strategies include text formatting toggles", () => {
  it("row strategy emits the bold/italic/strike/code/highlight toggles", () => {
    const editor = buildThreeByThreeTable();
    try {
      selectCells(editor, { row: 0, col: 0 }, { row: 0, col: 2 });
      const ops = pickStrategy(analyseSelection(editor.state)).build(
        analyseSelection(editor.state),
        editor,
      );
      const marks = ops.filter((o) => o.kind === "toggle").map((o) => o.mark);
      expect(marks).toEqual(
        expect.arrayContaining([
          "bold",
          "italic",
          "strike",
          "code",
          "highlight",
        ]),
      );
    } finally {
      editor.destroy();
    }
  });

  it("column strategy emits the bold/italic/strike/code/highlight toggles", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      selectCells(editor, { row: 0, col: 0 }, { row: 1, col: 0 });
      const ops = pickStrategy(analyseSelection(editor.state)).build(
        analyseSelection(editor.state),
        editor,
      );
      const marks = ops.filter((o) => o.kind === "toggle").map((o) => o.mark);
      expect(marks).toEqual(
        expect.arrayContaining([
          "bold",
          "italic",
          "strike",
          "code",
          "highlight",
        ]),
      );
    } finally {
      editor.destroy();
    }
  });
});

describe("cell strategy ops", () => {
  it("emits text formatting toggles + a clear-cell(s) action", () => {
    const editor = buildThreeByThreeTable();
    try {
      selectCells(editor, { row: 0, col: 0 }, { row: 1, col: 1 });
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      const ops = strategy.build(analysis, editor);
      const marks = ops.filter((o) => o.kind === "toggle").map((o) => o.mark);
      expect(marks).toEqual(
        expect.arrayContaining([
          "bold",
          "italic",
          "strike",
          "code",
          "highlight",
        ]),
      );
      const clearOp = ops.find(
        (o) => o.kind === "action" && o.id === "clear-cells",
      );
      expect(clearOp).toBeDefined();
      // tableBlock label is plural.
      expect(clearOp && "label" in clearOp ? clearOp.label : "").toBe(
        "Clear cell(s)",
      );
    } finally {
      editor.destroy();
    }
  });
});

describe("text strategy ops", () => {
  it("emits text formatting toggles + a clear-formatting action", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello world</p>");
      editor.commands.setTextSelection({ from: 2, to: 5 });
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      const ops = strategy.build(analysis, editor);
      const marks = ops.filter((o) => o.kind === "toggle").map((o) => o.mark);
      expect(marks).toEqual(
        expect.arrayContaining([
          "bold",
          "italic",
          "strike",
          "code",
          "highlight",
        ]),
      );
      const clearOp = ops.find(
        (o) => o.kind === "action" && o.id === "clear-formatting",
      );
      expect(clearOp).toBeDefined();
    } finally {
      editor.destroy();
    }
  });

  it("returns an empty op list for a collapsed selection", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello world</p>");
      editor.commands.focus("end");
      const analysis = analyseSelection(editor.state);
      const strategy = pickStrategy(analysis);
      const ops = strategy.build(analysis, editor);
      expect(ops).toEqual([]);
    } finally {
      editor.destroy();
    }
  });
});

function opIsAction(
  op: BubbleMenuOp,
): op is Extract<BubbleMenuOp, { kind: "action" }> {
  return op.kind === "action";
}
