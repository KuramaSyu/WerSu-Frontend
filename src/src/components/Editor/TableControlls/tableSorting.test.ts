// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  applyTableSort,
  compareTableCells,
  getTableRows,
  restoreTableRowOrder,
  tableHasHeaderRow,
} from "./tableSorting";

// Build rows with the DOM API: jsdom drops `<tr>` markup that is parsed
// directly inside a `<div>` (the runtime contentDOM is a div, but
// ProseMirror appends its rows programmatically).
function tableFromRows(rows: string[][], header = true): HTMLElement {
  const root = document.createElement("div");
  rows.forEach((cells, rowIndex) => {
    const row = document.createElement("tr");
    const tag = header && rowIndex === 0 ? "th" : "td";
    for (const text of cells) {
      const cell = document.createElement(tag);
      cell.textContent = text;
      row.appendChild(cell);
    }
    root.appendChild(row);
  });
  return root;
}

const rowText = (row: HTMLTableRowElement): string => row.textContent ?? "";

describe("view-only table sorting", () => {
  it("sorts naturally, including numbers in text", () => {
    expect(compareTableCells("Row 2", "Row 10", "asc")).toBeLessThan(0);
    expect(compareTableCells("Row 2", "Row 10", "desc")).toBeGreaterThan(0);
  });

  it("keeps empty cells last in both directions", () => {
    expect(compareTableCells("", "a", "asc")).toBeGreaterThan(0);
    expect(compareTableCells("", "a", "desc")).toBeGreaterThan(0);
    expect(compareTableCells("a", "", "asc")).toBeLessThan(0);
  });

  it("detects a header row from th cells", () => {
    expect(tableHasHeaderRow(getTableRows(tableFromRows([["A"], ["b"]])))).toBe(
      true,
    );
    expect(
      tableHasHeaderRow(getTableRows(tableFromRows([["A"], ["b"]], false))),
    ).toBe(false);
  });

  it("sorts only body rows and leaves the header in place", () => {
    const root = tableFromRows([
      ["Name", "Score"],
      ["Zoe", "2"],
      ["Amy", "10"],
      ["Bob", "1"],
    ]);

    applyTableSort(root, 0, "asc");

    expect(getTableRows(root).map(rowText).slice(1)).toEqual([
      "Amy10",
      "Bob1",
      "Zoe2",
    ]);
    expect(rowText(getTableRows(root)[0])).toBe("NameScore");
  });

  it("restores the original document order", () => {
    const root = tableFromRows([
      ["Name", "Score"],
      ["Zoe", "2"],
      ["Amy", "10"],
      ["Bob", "1"],
    ]);
    const before = getTableRows(root).map(rowText);

    applyTableSort(root, 1, "desc");
    expect(getTableRows(root).map(rowText)).not.toEqual(before);

    restoreTableRowOrder(root);
    expect(getTableRows(root).map(rowText)).toEqual(before);
    expect(
      getTableRows(root).some(
        (row) => row.dataset.tableSortOriginalIndex !== undefined,
      ),
    ).toBe(false);
  });

  it("sorts every row when the table has no header", () => {
    const root = tableFromRows(
      [
        ["Zoe", "2"],
        ["Amy", "10"],
      ],
      false,
    );

    applyTableSort(root, 1, "asc");

    expect(getTableRows(root).map(rowText)).toEqual(["Zoe2", "Amy10"]);
  });
});
