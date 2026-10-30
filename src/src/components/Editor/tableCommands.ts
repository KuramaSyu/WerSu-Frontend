// Command catalogue for table edits.
//
// A command is the pattern the whole app uses for "one menu button":
// an id, a label (which may pluralise from the selection), the icon
// names each surface wants, an applicability probe, and a single run
// function. The bubble strategies and the right-click presets both
// build their menus from this list, so a new table operation is added
// in one place and appears on both surfaces.

import type { Editor } from "@tiptap/core";
import type { SelectionAnalysisFull } from "./bubbleMenuStrategies";
import {
  clearCells,
  moveColumnsByDelta,
  moveRowsByDelta,
} from "./tableOperations";

export type TableCommandId =
  | "add-row-before"
  | "add-row-after"
  | "add-column-before"
  | "add-column-after"
  | "move-row-up"
  | "move-row-down"
  | "move-column-left"
  | "move-column-right"
  | "delete-row"
  | "delete-column"
  | "clear-cells"
  | "delete-table";

export interface TableCommand {
  id: TableCommandId;
  /** May pluralise from the selection (for example Delete row/rows). */
  label: (analysis: SelectionAnalysisFull) => string;
  /** Icon name consumed by the bubble menu renderer. */
  bubbleIcon: string;
  /** Which bubble section the op belongs to. */
  group: "table" | "common";
  /** Whether this command is offered for the given selection. */
  appliesTo: (analysis: SelectionAnalysisFull) => boolean;
  run: (editor: Editor, analysis: SelectionAnalysisFull) => void;
}

// Any cell/row/column/block selection, but not a whole-table selection.
function inEditableBand(analysis: SelectionAnalysisFull): boolean {
  return Boolean(analysis.cell) && analysis.kind !== "tableWhole";
}

// A single cell or an arbitrary block of cells, where a clear applies.
function inClearableBlock(analysis: SelectionAnalysisFull): boolean {
  return (
    analysis.kind === "tableCell" ||
    analysis.kind === "tableBlock" ||
    (analysis.kind === "text" && Boolean(analysis.cell))
  );
}

// Canonical order. Adding a command here is all it takes to surface it
// on both the bubble menu and the right-click menu.
export const TABLE_COMMANDS: readonly TableCommand[] = [
  {
    id: "add-row-before",
    label: () => "Insert row above",
    bubbleIcon: "row-insert-top",
    group: "table",
    appliesTo: inEditableBand,
    run: (editor) => {
      editor.chain().focus().addRowBefore().run();
    },
  },
  {
    id: "add-row-after",
    label: () => "Insert row below",
    bubbleIcon: "row-insert-bottom",
    group: "table",
    appliesTo: inEditableBand,
    run: (editor) => {
      editor.chain().focus().addRowAfter().run();
    },
  },
  {
    id: "add-column-before",
    label: () => "Insert column left",
    bubbleIcon: "column-insert-left",
    group: "table",
    appliesTo: inEditableBand,
    run: (editor) => {
      editor.chain().focus().addColumnBefore().run();
    },
  },
  {
    id: "add-column-after",
    label: () => "Insert column right",
    bubbleIcon: "column-insert-right",
    group: "table",
    appliesTo: inEditableBand,
    run: (editor) => {
      editor.chain().focus().addColumnAfter().run();
    },
  },
  {
    id: "move-row-up",
    label: () => "Move row up",
    bubbleIcon: "row-move-up",
    group: "table",
    appliesTo: inEditableBand,
    run: (editor, analysis) => {
      if (analysis.cell) moveRowsByDelta(editor, -1, analysis.cell.rowIndices);
    },
  },
  {
    id: "move-row-down",
    label: () => "Move row down",
    bubbleIcon: "row-move-down",
    group: "table",
    appliesTo: inEditableBand,
    run: (editor, analysis) => {
      if (analysis.cell) moveRowsByDelta(editor, 1, analysis.cell.rowIndices);
    },
  },
  {
    id: "move-column-left",
    label: () => "Move column left",
    bubbleIcon: "column-move-left",
    group: "table",
    appliesTo: inEditableBand,
    run: (editor, analysis) => {
      if (analysis.cell) {
        moveColumnsByDelta(editor, -1, analysis.cell.columnIndices);
      }
    },
  },
  {
    id: "move-column-right",
    label: () => "Move column right",
    bubbleIcon: "column-move-right",
    group: "table",
    appliesTo: inEditableBand,
    run: (editor, analysis) => {
      if (analysis.cell) {
        moveColumnsByDelta(editor, 1, analysis.cell.columnIndices);
      }
    },
  },
  {
    id: "delete-row",
    label: (analysis) =>
      (analysis.cell?.rowIndices.length ?? 0) > 1
        ? "Delete rows"
        : "Delete row",
    bubbleIcon: "row-remove",
    group: "table",
    appliesTo: inEditableBand,
    run: (editor) => {
      editor.chain().focus().deleteRow().run();
    },
  },
  {
    id: "delete-column",
    label: (analysis) =>
      (analysis.cell?.columnIndices.length ?? 0) > 1
        ? "Delete columns"
        : "Delete column",
    bubbleIcon: "column-remove",
    group: "table",
    appliesTo: inEditableBand,
    run: (editor) => {
      editor.chain().focus().deleteColumn().run();
    },
  },
  {
    id: "clear-cells",
    label: (analysis) =>
      analysis.kind === "tableBlock" ? "Clear cell(s)" : "Clear cell",
    bubbleIcon: "format-clear",
    group: "common",
    appliesTo: inClearableBlock,
    run: (editor) => {
      clearCells(editor);
    },
  },
  {
    id: "delete-table",
    label: () => "Delete table",
    bubbleIcon: "table-remove",
    group: "table",
    appliesTo: (analysis) => Boolean(analysis.cell),
    run: (editor) => {
      editor.chain().focus().deleteTable().run();
    },
  },
];

export function tableCommandsFor(
  analysis: SelectionAnalysisFull,
  ids?: readonly TableCommandId[],
): TableCommand[] {
  return TABLE_COMMANDS.filter(
    (command) =>
      (ids ? ids.includes(command.id) : true) && command.appliesTo(analysis),
  );
}
