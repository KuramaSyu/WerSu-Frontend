// Table command catalogue: applicability and selection-aware labels.

import { describe, expect, it } from "vitest";
import type { SelectionAnalysisFull } from "./bubbleMenuStrategies";
import { TABLE_COMMANDS, tableCommandsFor } from "./tableCommands";

function analysis(
  kind: SelectionAnalysisFull["kind"],
  rowIndices: number[] = [0],
  columnIndices: number[] = [0],
): SelectionAnalysisFull {
  return {
    kind,
    editable: true,
    state: {} as SelectionAnalysisFull["state"],
    cell:
      rowIndices.length || columnIndices.length
        ? ({
            rowIndices,
            columnIndices,
          } as never)
        : undefined,
  };
}

describe("tableCommandsFor", () => {
  it("returns every operation for a single cell", () => {
    const ids = tableCommandsFor(analysis("tableCell")).map((c) => c.id);
    expect(ids).toContain("add-row-before");
    expect(ids).toContain("move-column-right");
    expect(ids).toContain("clear-cells");
    expect(ids).toContain("delete-table");
  });

  it("returns only delete table for a whole-table selection", () => {
    const ids = tableCommandsFor(analysis("tableWhole")).map((c) => c.id);
    expect(ids).toEqual(["delete-table"]);
  });

  it("returns nothing outside a table", () => {
    expect(tableCommandsFor(analysis("text", [], []))).toEqual([]);
  });

  it("pluralises delete labels from the selection", () => {
    const multi = tableCommandsFor(
      analysis("tableRow", [0, 1], [0]),
    );
    expect(multi.find((c) => c.id === "delete-row")?.label(analysis("tableRow", [0, 1], [0]))).toBe(
      "Delete rows",
    );
    expect(multi.find((c) => c.id === "delete-column")?.label(analysis("tableRow", [0, 1], [0]))).toBe(
      "Delete column",
    );
  });

  it("keeps a stable catalogue order", () => {
    expect(TABLE_COMMANDS.map((c) => c.id)).toEqual([
      "add-row-before",
      "add-row-after",
      "add-column-before",
      "add-column-after",
      "move-row-up",
      "move-row-down",
      "move-column-left",
      "move-column-right",
      "delete-row",
      "delete-column",
      "clear-cells",
      "delete-table",
    ]);
  });
});
