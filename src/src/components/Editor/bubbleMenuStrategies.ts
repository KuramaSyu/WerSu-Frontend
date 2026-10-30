// Strategy pattern: analyseSelection -> pickStrategy -> op list.

import type { Editor } from "@tiptap/core";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import type { EditorState } from "@tiptap/pm/state";

export type SelectionKind =
  | "empty"
  | "multiTable"
  | "tableWhole"
  | "tableRow"
  | "tableColumn"
  | "tableBlock"
  | "tableCell"
  | "text";

export interface CellContext {
  tableNode: unknown;
  tablePos: number;
  map: TableMap;
  rect: { left: number; top: number; right: number; bottom: number };
  rowIndices: number[];
  columnIndices: number[];
}

export interface SelectionAnalysisFull {
  kind: SelectionKind;
  editable: boolean;
  state: EditorState;
  cell?: CellContext;
}

// One button the bubble menu renders. Each op carries a
// `group` so the renderer can lay them out as
// `<table ops> | <common ops> | <copy>` with a single divider
// between each pair. Strategies emit ops already sorted by
// group; dividers belong to the renderer, not the strategy.
export type BubbleMenuGroup = "table" | "common";

export type BubbleMenuOp =
  | {
      kind: "toggle";
      mark: string;
      label: string;
      icon: string;
      group: BubbleMenuGroup;
    }
  | {
      kind: "action";
      id: string;
      label: string;
      icon: string;
      group: BubbleMenuGroup;
      run: (editor: Editor) => void;
    }
  | {
      kind: "copy";
      mode: "html" | "text";
      label: string;
      icon: string;
      text: string;
    };

export interface BubbleMenuStrategy {
  readonly name: string;
  matches(analysis: SelectionAnalysisFull): boolean;
  build(analysis: SelectionAnalysisFull, editor: Editor): BubbleMenuOp[];
}

function findTableContext(
  state: EditorState,
): { tableDepth: number; cellDepth: number } | null {
  const { $from } = state.selection;
  let tableDepth = -1;
  let cellDepth = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (tableDepth === -1 && node.type.name === "table") {
      tableDepth = depth;
    }
    if (
      cellDepth === -1 &&
      (node.type.name === "tableCell" || node.type.name === "tableHeader")
    ) {
      cellDepth = depth;
    }
    if (tableDepth !== -1 && cellDepth !== -1) break;
  }
  if (tableDepth === -1 || cellDepth === -1) return null;
  return { tableDepth, cellDepth };
}

type TableScope = "in-table" | "none" | "multi-table";

function classifyTableScope(state: EditorState): TableScope {
  if (state.selection instanceof CellSelection) return "in-table";
  const { $from, $to } = state.selection;
  const fromTable = nearestTableDepth($from);
  const toTable = nearestTableDepth($to);
  if (fromTable === -1 && toTable === -1) return "none";
  if (fromTable === -1 || toTable === -1) return "multi-table";
  return fromTable === toTable ? "in-table" : "multi-table";
}

function nearestTableDepth($pos: {
  depth: number;
  node: (d: number) => { type: { name: string } };
}): number {
  for (let d = $pos.depth; d > 0; d -= 1) {
    if ($pos.node(d).type.name === "table") return d;
  }
  return -1;
}

function collectCellSelectionContext(state: EditorState): CellContext | null {
  if (!(state.selection instanceof CellSelection)) return null;
  const { $anchorCell, $headCell } = state.selection;
  const tableNode = $anchorCell.node(-1);
  const tablePos = $anchorCell.start(-1) - 1;
  const map = TableMap.get(tableNode);
  const tableStart = $anchorCell.start(-1);
  const anchorRect = map.findCell($anchorCell.pos - tableStart);
  const headRect = map.findCell($headCell.pos - tableStart);
  const rect = {
    left: Math.min(anchorRect.left, headRect.left),
    right: Math.max(anchorRect.right, headRect.right),
    top: Math.min(anchorRect.top, headRect.top),
    bottom: Math.max(anchorRect.bottom, headRect.bottom),
  };
  const rowIndices = new Set<number>();
  const columnIndices = new Set<number>();
  state.selection.forEachCell((_node, pos) => {
    const r = map.findCell(pos - tableStart);
    rowIndices.add(r.top);
    columnIndices.add(r.left);
  });
  return {
    tableNode,
    tablePos,
    map,
    rect,
    rowIndices: Array.from(rowIndices).sort((a, b) => a - b),
    columnIndices: Array.from(columnIndices).sort((a, b) => a - b),
  };
}

export function analyseSelection(state: EditorState): SelectionAnalysisFull {
  const { selection } = state;
  const editable = state.doc && selection.from !== selection.to;
  if (selection.empty) return { kind: "empty", editable, state };

  const scope = classifyTableScope(state);
  if (scope === "multi-table") return { kind: "multiTable", editable, state };

  const cell = collectCellSelectionContext(state);
  if (cell) {
    if (selection instanceof CellSelection) {
      const { left, right, top, bottom } = cell.rect;
      // Whole table: every cell selected. Single-delete option
      // wins because row/column moves / clears no longer apply.
      const isWholeTable =
        left === 0 &&
        top === 0 &&
        right === cell.map.width &&
        bottom === cell.map.height;
      if (isWholeTable) return { kind: "tableWhole", editable, state, cell };
      // Full row band: spans all columns, any row count.
      const isFullRow = cell.map.width === right - left;
      // Full column band: spans all rows, any column count.
      const isFullColumn = cell.map.height === bottom - top;
      if (isFullRow) return { kind: "tableRow", editable, state, cell };
      if (isFullColumn) return { kind: "tableColumn", editable, state, cell };
      return { kind: "tableBlock", editable, state, cell };
    }
  }

  // In-cell text selection: still in-table, cell strategy picks it up.
  if (findTableContext(state)) {
    const inCell = inCellContext(state);
    if (inCell) return { kind: "text", editable, state, cell: inCell };
  }
  return { kind: "text", editable, state };
}

function inCellContext(state: EditorState): CellContext | null {
  const { $from } = state.selection;
  let tableDepth = -1;
  let cellDepth = -1;
  for (let d = $from.depth; d > 0; d -= 1) {
    const node = $from.node(d);
    if (tableDepth === -1 && node.type.name === "table") tableDepth = d;
    if (
      cellDepth === -1 &&
      (node.type.name === "tableCell" || node.type.name === "tableHeader")
    ) {
      cellDepth = d;
    }
    if (tableDepth !== -1 && cellDepth !== -1) break;
  }
  if (tableDepth === -1 || cellDepth === -1) return null;
  const tableNode = $from.node(tableDepth);
  const tablePos = (
    $from as unknown as { before: (d: number) => number }
  ).before(tableDepth);
  const map = TableMap.get(tableNode);
  const cellPosInTable = $from.before(cellDepth) - tablePos - 1;
  if (cellPosInTable < 0) return null;
  const cellRect = map.findCell(cellPosInTable);
  return {
    tableNode,
    tablePos,
    map,
    rect: {
      left: cellRect.left,
      right: cellRect.right,
      top: cellRect.top,
      bottom: cellRect.bottom,
    },
    rowIndices: [cellRect.top],
    columnIndices: [cellRect.left],
  };
}

const tableWholeStrategy: BubbleMenuStrategy = {
  name: "table-whole",
  matches: (a) => a.kind === "tableWhole",
  build: () => {
    return [
      {
        kind: "action",
        group: "table",
        id: "delete-table",
        label: "Delete table",
        icon: "table-remove",

        run: (e) => e.chain().focus().deleteTable().run(),
      },
    ];
  },
};

const rowStrategy: BubbleMenuStrategy = {
  name: "table-row",
  matches: (a) => a.kind === "tableRow",
  build: (a, editor) => {
    if (!a.cell) return [];
    const { rowIndices } = a.cell;
    const isMulti = rowIndices.length > 1;
    // Table edits first, common formatting second. The
    // renderer inserts the single `|` between groups; the
    // intra-group ordering here drives button placement.
    return [
      {
        kind: "action",
        group: "table",
        id: "add-row-before",
        label: "Add row above",
        icon: "row-insert-top",

        run: (e) => e.chain().focus().addRowBefore().run(),
      },
      {
        kind: "action",
        group: "table",
        id: "add-row-after",
        label: "Add row below",
        icon: "row-insert-bottom",

        run: (e) => e.chain().focus().addRowAfter().run(),
      },
      {
        kind: "action",
        group: "table",
        id: "move-row-up",
        label: "Move row up",
        icon: "row-move-up",

        run: (e) => moveRowsByDelta(e, -1, rowIndices),
      },
      {
        kind: "action",
        group: "table",
        id: "move-row-down",
        label: "Move row down",
        icon: "row-move-down",

        run: (e) => moveRowsByDelta(e, 1, rowIndices),
      },
      {
        kind: "action",
        group: "table",
        // Pluralise for multi-row selections.
        id: "delete-row",
        label: isMulti ? "Delete rows" : "Delete row",
        icon: "row-remove",

        run: (e) => e.chain().focus().deleteRow().run(),
      },
      ...textFormattingOps(editor, a.state),
    ];
  },
};

const columnStrategy: BubbleMenuStrategy = {
  name: "table-column",
  matches: (a) => a.kind === "tableColumn",
  build: (a, editor) => {
    if (!a.cell) return [];
    const { columnIndices } = a.cell;
    const isMulti = columnIndices.length > 1;
    return [
      {
        kind: "action",
        group: "table",
        id: "add-column-before",
        label: "Add column left",
        icon: "column-insert-left",

        run: (e) => e.chain().focus().addColumnBefore().run(),
      },
      {
        kind: "action",
        group: "table",
        id: "add-column-after",
        label: "Add column right",
        icon: "column-insert-right",

        run: (e) => e.chain().focus().addColumnAfter().run(),
      },
      {
        kind: "action",
        group: "table",
        id: "move-column-left",
        label: "Move column left",
        icon: "column-move-left",

        run: (e) => moveColumnsByDelta(e, -1, columnIndices),
      },
      {
        kind: "action",
        group: "table",
        id: "move-column-right",
        label: "Move column right",
        icon: "column-move-right",

        run: (e) => moveColumnsByDelta(e, 1, columnIndices),
      },
      {
        kind: "action",
        group: "table",
        // Pluralise for multi-column selections.
        id: "delete-column",
        label: isMulti ? "Delete columns" : "Delete column",
        icon: "column-remove",

        run: (e) => e.chain().focus().deleteColumn().run(),
      },
      ...textFormattingOps(editor, a.state),
    ];
  },
};

const cellStrategy: BubbleMenuStrategy = {
  name: "table-cell",
  matches: (a) =>
    a.kind === "tableCell" ||
    a.kind === "tableBlock" ||
    (a.kind === "text" && !!a.cell),
  build: (a, editor) => {
    return [
      ...textFormattingOps(editor, a.state),
      {
        kind: "action",
        group: "common",
        id: "clear-cells",
        label: a.kind === "tableBlock" ? "Clear cell(s)" : "Clear cell",
        icon: "format-clear",

        run: (e) => clearCells(e),
      },
    ];
  },
};

const textStrategy: BubbleMenuStrategy = {
  name: "text",
  matches: (a) => a.kind === "text" || a.kind === "multiTable",
  build: (a, editor) => {
    const { from, to, empty } = a.state.selection;
    if (empty || from === to) return [];
    return [
      ...textFormattingOps(editor, a.state),
      {
        kind: "action",
        group: "common",
        id: "clear-formatting",
        label: "Clear formatting",
        icon: "format-clear",

        run: (e) => e.chain().focus().unsetAllMarks().clearNodes().run(),
      },
    ];
  },
};

const fallbackStrategy: BubbleMenuStrategy = textStrategy;

// Priority order: most specific first.
export const BUBBLE_MENU_STRATEGIES: readonly BubbleMenuStrategy[] = [
  tableWholeStrategy,
  rowStrategy,
  columnStrategy,
  cellStrategy,
  textStrategy,
] as const;

export function pickStrategy(
  analysis: SelectionAnalysisFull,
): BubbleMenuStrategy {
  for (const strategy of BUBBLE_MENU_STRATEGIES) {
    if (strategy.matches(analysis)) return strategy;
  }
  return fallbackStrategy;
}

function textFormattingOps(editor: Editor, state: EditorState): BubbleMenuOp[] {
  const { from, to } = state.selection;
  if (from === to) return [];
  return [
    {
      kind: "toggle",
      group: "common",
      mark: "bold",
      label: "Bold",
      icon: "format-bold",
    },
    {
      kind: "toggle",
      group: "common",
      mark: "italic",
      label: "Italic",
      icon: "format-italic",
    },
    {
      kind: "toggle",
      group: "common",
      mark: "strike",
      label: "Strikethrough",
      icon: "format-strikethrough",
    },
    {
      kind: "toggle",
      group: "common",
      mark: "code",
      label: "Inline code",
      icon: "code",
    },
    {
      kind: "toggle",
      group: "common",
      mark: "highlight",
      label: "Highlight",
      icon: "highlight",
    },
  ];
}

// Tiptap ships no clearCells, so walk forEachCell and replace each.
// Exported for the right-click table submenu.
export function clearCells(editor: Editor): void {
  const sel = editor.state.selection;
  if (sel instanceof CellSelection) {
    const { tr } = editor.state;
    const empty = editor.schema.nodes.paragraph?.create();
    if (!empty) return;
    const replacements: Array<{ from: number; to: number }> = [];
    sel.forEachCell((cellNode, pos) => {
      if (cellNode.content.size > 0) {
        replacements.push({ from: pos + 1, to: pos + cellNode.nodeSize - 1 });
      }
    });
    // Right-to-left so earlier positions stay valid.
    for (const { from, to } of replacements.reverse()) {
      tr.replaceWith(from, to, empty);
    }
    editor.view.dispatch(tr);
    editor.view.focus();
    return;
  }
  editor.chain().focus().deleteSelection().run();
}

// Tiptap's moveRow only handles a single row; do a full-table
// replace. We swap row nodes in the table's row array and
// reinstall a `CellSelection.rowSelection` on the new row so
// the menu stays in place across the swap. Using
// `rowSelection` (not `CellSelection.create`) is important:
// the factory expands anchor/head to the full row band, which
// avoids the last cell's text leaking into the selection rect.
function moveRowsByDelta(
  editor: Editor,
  delta: -1 | 1,
  indices: number[],
): void {
  const { state } = editor;
  const { $from } = state.selection;
  let tableDepth = -1;
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name === "table") {
      tableDepth = d;
      break;
    }
  }
  if (tableDepth === -1) return;

  const tableNode = $from.node(tableDepth);
  const tablePos = (
    $from as unknown as { before: (d: number) => number }
  ).before(tableDepth);
  const map = TableMap.get(tableNode);

  // Bounds check. Bail out (no-op) when the band already
  // touches the destination edge.
  if (delta === -1 && indices[0] === 0) return;
  if (delta === 1 && indices[indices.length - 1] === map.height - 1) return;

  // Build a fresh row array with the band shifted by one.
  // We use plain node references from `table.content.content`
  // and only re-create the table itself; rows keep their
  // internal `content` Fragment untouched.
  const rows = tableNode.content.content.slice();
  if (delta === -1) {
    for (const idx of indices) {
      [rows[idx - 1], rows[idx]] = [rows[idx], rows[idx - 1]];
    }
  } else {
    for (const idx of [...indices].reverse()) {
      [rows[idx + 1], rows[idx]] = [rows[idx], rows[idx + 1]];
    }
  }

  const newTable = tableNode.type.create(
    tableNode.attrs,
    rows,
    tableNode.marks,
  );

  // Compute where the band lands in the new table so we can
  // pass the first and last cell positions to
  // `CellSelection.rowSelection`, which expands the band to
  // the full row extent.
  const newMap = TableMap.get(newTable);
  const newTopRow =
    delta === -1 ? indices[0] - 1 : indices[indices.length - 1] + 1;
  const newBotRow = newTopRow + indices.length - 1;
  const firstCellPos =
    tablePos + 1 + newMap.positionAt(newTopRow, 0, newTable);
  const lastCellPos =
    tablePos + 1 + newMap.positionAt(newBotRow, map.width - 1, newTable);

  const tr = state.tr
    .replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable)
    // Prevent the autolink plugin from re-scanning the new
    // table -- the eq check on the new doc trips over a
    // re-created Fragment slot when we re-create the table
    // from raw node refs, and the link autolink isn't needed
    // for a row swap anyway.
    .setMeta("preventAutolink", true);
  // Resolve against the new doc (post-`replaceWith`) so the
  // positions point into the new table.
  const newDoc = tr.doc;
  tr.setSelection(
    CellSelection.rowSelection(
      newDoc.resolve(firstCellPos),
      newDoc.resolve(lastCellPos),
    ),
  );

  editor.view.dispatch(tr);
  editor.view.focus();
}

function moveColumnsByDelta(
  editor: Editor,
  delta: -1 | 1,
  indices: number[],
): void {
  const { state } = editor;
  const { $from } = state.selection;
  let tableDepth = -1;
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name === "table") {
      tableDepth = d;
      break;
    }
  }
  if (tableDepth === -1) return;

  const tableNode = $from.node(tableDepth);
  const tablePos = (
    $from as unknown as { before: (d: number) => number }
  ).before(tableDepth);
  const map = TableMap.get(tableNode);

  if (delta === -1 && indices[0] === 0) return;
  if (delta === 1 && indices[indices.length - 1] === map.width - 1) return;

  // Build a fresh row array where each row's cells are
  // re-ordered according to the band shift.
  const rows = tableNode.content.content.map((row) => {
    const cells = row.content.content.slice();
    if (delta === -1) {
      for (const idx of indices) {
        [cells[idx - 1], cells[idx]] = [cells[idx], cells[idx - 1]];
      }
    } else {
      for (const idx of [...indices].reverse()) {
        [cells[idx + 1], cells[idx]] = [cells[idx], cells[idx + 1]];
      }
    }
    return row.type.create(row.attrs, cells, row.marks);
  });

  const newTable = tableNode.type.create(
    tableNode.attrs,
    rows,
    tableNode.marks,
  );

  // Restore the CellSelection on the moved band using the
  // `colSelection` factory, which expands the band to the
  // full column extent. Same rationale as `rowSelection`
  // for rows above.
  const newMap = TableMap.get(newTable);
  const newLeftCol =
    delta === -1 ? indices[0] - 1 : indices[indices.length - 1] + 1;
  const newRightCol = newLeftCol + indices.length - 1;
  const firstCellPos =
    tablePos + 1 + newMap.positionAt(0, newLeftCol, newTable);
  const lastCellPos =
    tablePos +
    1 +
    newMap.positionAt(map.height - 1, newRightCol, newTable);

  const tr = state.tr
    .replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable)
    .setMeta("preventAutolink", true);
  const newDoc = tr.doc;
  tr.setSelection(
    CellSelection.colSelection(
      newDoc.resolve(firstCellPos),
      newDoc.resolve(lastCellPos),
    ),
  );

  editor.view.dispatch(tr);
  editor.view.focus();
}
