// Backspace handler for empty tables and empty rows.
//
// Default ProseMirror/Tiptap behaviour leaves the caret stuck when the
// table (or the row) has no content: pressing Backspace in the first
// cell does nothing, because there is no character to delete. This
// handler turns that dead keystroke into a structural delete:
//
//   * caret in the first cell of a fully empty table -> delete table
//   * caret in the first cell of an empty row        -> delete row
//
// It mirrors `codeBlockTabKey.ts`: the handler reads selection
// ancestry straight from `view.state` (no stale React closure) and is
// wired into `editorProps.handleKeyDown` in `NoteEditorCore.hook`.
// Anything it does not own returns `false` so the default key handling
// still runs.

import type { EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import {
  TableMap,
  deleteTable,
  removeRow,
  selectedRect,
} from "@tiptap/pm/tables";

const TABLE_NAME = "table";
const CELL_NAMES = new Set(["tableCell", "tableHeader"]);

/** Where the caret sits inside a table. */
interface TableCellContext {
  /** The `table` node enclosing the caret. */
  readonly tableNode: PMNode;
  /** Row band index of the cell containing the caret. */
  readonly row: number;
  /** Column band index of the cell containing the caret. */
  readonly column: number;
}

/** Find the closest table cell ancestor of the caret and resolve its
 *  row/column from the table map. Returns `null` when the caret is not
 *  inside a table cell. */
const findTableCell = (view: EditorView): TableCellContext | null => {
  const { $from } = view.state.selection;

  let tableDepth = -1;
  let cellDepth = -1;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (cellDepth === -1 && CELL_NAMES.has(name)) cellDepth = d;
    if (name === TABLE_NAME) {
      tableDepth = d;
      break;
    }
  }
  if (tableDepth === -1 || cellDepth === -1) return null;

  const tableNode = $from.node(tableDepth);
  const tableStart = $from.start(tableDepth);
  const cellPos = $from.before(cellDepth);
  const { top, left } = TableMap.get(tableNode).findCell(
    cellPos - tableStart,
  );

  return { tableNode, row: top, column: left };
};

/**
 * Whether a cell holds no meaningful content.
 *
 * An empty Tiptap cell is `<td><p></p></td>`, so text-only checks are
 * not enough: an image / hardBreak / inline math is a leaf node, and a
 * cell holding one must not be treated as empty.
 */
const cellIsEmpty = (cell: PMNode): boolean => {
  let empty = true;
  cell.descendants((node) => {
    if (!empty) return false;
    if (node.isText) {
      if ((node.text ?? "").trim().length > 0) empty = false;
      return false;
    }
    if (node.isLeaf) {
      empty = false;
      return false;
    }
    return true;
  });
  return empty;
};

/** Whether every cell that starts in `rowIndex` is empty. */
const rowIsEmpty = (tableNode: PMNode, rowIndex: number): boolean => {
  let empty = true;
  tableNode.child(rowIndex).forEach((cell) => {
    if (!cellIsEmpty(cell)) empty = false;
  });
  return empty;
};

/** Whether every cell of the table is empty. */
const tableIsEmpty = (tableNode: PMNode): boolean => {
  let empty = true;
  tableNode.forEach((row) => {
    row.forEach((cell) => {
      if (!cellIsEmpty(cell)) empty = false;
    });
  });
  return empty;
};

/** Position just inside the first cell of `row` in a table that starts
 *  at `tablePos`, clamped to the table's row range. `null` when the
 *  table node cannot be found in `doc`. */
const firstCellPosition = (
  doc: PMNode,
  tablePos: number,
  row: number,
): number | null => {
  const tableNode = doc.nodeAt(tablePos);
  if (!tableNode || tableNode.type.name !== TABLE_NAME) return null;
  const target = Math.max(0, Math.min(row, tableNode.childCount - 1));
  const map = TableMap.get(tableNode);
  return tablePos + 1 + map.positionAt(target, 0, tableNode);
};

/**
 * Backspace dispatch for structurally empty tables / rows.
 *
 * @returns `true` when the event was consumed (caller should let
 *          `handleKeyDown` report it handled), `false` to fall
 *          through to the default Backspace behaviour.
 */
export const handleTableBackspaceKey = (
  view: EditorView,
  event: KeyboardEvent,
): boolean => {
  if (event.key !== "Backspace") return false;
  // Never hijack a keystroke that is part of an IME composition.
  if (event.isComposing) return false;
  // Leave modifier variants (e.g. Cmd+Backspace) to the platform and
  // the built-in table shortcuts.
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  // Only a collapsed caret promises the "first cell" semantics.
  if (!view.state.selection.empty) return false;

  const context = findTableCell(view);
  if (!context) return false;
  const { tableNode, row, column } = context;

  // Not the first cell of its row: nothing structural to do.
  if (column !== 0) return false;

  // Prefer deleting the whole table when it is completely empty and
  // the caret is in its very first cell.
  if (row === 0 && tableIsEmpty(tableNode)) {
    event.preventDefault();
    deleteTable(view.state, view.dispatch);
    return true;
  }

  // Otherwise drop just the empty row the caret lives in. Delete it
  // in a single transaction and move the caret into the row above (or
  // the new first row when the deleted row was the first one) instead
  // of leaving it on the row that shifts up into its place.
  if (rowIsEmpty(tableNode, row)) {
    event.preventDefault();
    const rect = selectedRect(view.state);
    const tr = view.state.tr;
    removeRow(tr, rect, row);
    const targetRow = Math.max(0, row - 1);
    const cellPos = firstCellPosition(tr.doc, rect.tableStart - 1, targetRow);
    if (cellPos !== null) {
      tr.setSelection(TextSelection.near(tr.doc.resolve(cellPos + 1), 1));
    }
    view.dispatch(tr);
    return true;
  }

  return false;
};
