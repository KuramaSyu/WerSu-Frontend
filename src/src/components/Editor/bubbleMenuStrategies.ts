// Strategy pattern: analyseSelection -> pickStrategy -> op list.

import type { Editor } from "@tiptap/core";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import type { EditorState } from "@tiptap/pm/state";
import {
  tableCommandsFor,
  type TableCommandId,
} from "./tableCommands";

// Re-exported so existing importers keep one import site for the
// shared table operations. The implementation lives in tableOperations.
export { clearCells } from "./tableOperations";

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

// The command ids each strategy is allowed to surface. The actual
// run/label/icon data comes from the shared command catalogue, so the
// right-click menu and the bubble menu cannot drift apart.
const ROW_COMMAND_IDS: readonly TableCommandId[] = [
  "add-row-before",
  "add-row-after",
  "move-row-up",
  "move-row-down",
  "delete-row",
];
const COLUMN_COMMAND_IDS: readonly TableCommandId[] = [
  "add-column-before",
  "add-column-after",
  "move-column-left",
  "move-column-right",
  "delete-column",
];
const CELL_COMMAND_IDS: readonly TableCommandId[] = ["clear-cells"];
const WHOLE_TABLE_COMMAND_IDS: readonly TableCommandId[] = ["delete-table"];

// Turn applicable commands into bubble-menu actions in catalogue order.
function buildTableOps(
  ids: readonly TableCommandId[],
  analysis: SelectionAnalysisFull,
): BubbleMenuOp[] {
  return tableCommandsFor(analysis, ids).map((command) => ({
    kind: "action" as const,
    group: command.group,
    id: command.id,
    label: command.label(analysis),
    icon: command.bubbleIcon,
    run: (e: Editor) => command.run(e, analysis),
  }));
}

const tableWholeStrategy: BubbleMenuStrategy = {
  name: "table-whole",
  matches: (a) => a.kind === "tableWhole",
  build: (a) => buildTableOps(WHOLE_TABLE_COMMAND_IDS, a),
};

const rowStrategy: BubbleMenuStrategy = {
  name: "table-row",
  matches: (a) => a.kind === "tableRow",
  // Table edits first, common formatting second. The renderer inserts
  // the single `|` between groups; catalogue order drives placement.
  build: (a, editor) => [
    ...buildTableOps(ROW_COMMAND_IDS, a),
    ...textFormattingOps(editor, a.state),
  ],
};

const columnStrategy: BubbleMenuStrategy = {
  name: "table-column",
  matches: (a) => a.kind === "tableColumn",
  build: (a, editor) => [
    ...buildTableOps(COLUMN_COMMAND_IDS, a),
    ...textFormattingOps(editor, a.state),
  ],
};

const cellStrategy: BubbleMenuStrategy = {
  name: "table-cell",
  matches: (a) =>
    a.kind === "tableCell" ||
    a.kind === "tableBlock" ||
    (a.kind === "text" && !!a.cell),
  build: (a, editor) => [
    ...textFormattingOps(editor, a.state),
    ...buildTableOps(CELL_COMMAND_IDS, a),
  ],
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

