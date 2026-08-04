/* eslint-disable react-refresh/only-export-components */
// Co-locates the column-menu hook with the presentational
// buttons it powers. Fast Refresh prefers one-component-per-file
// but keeping these together keeps the column-menu surface in
// one place.
import { IconButton, Paper, Stack, Tooltip } from "@mui/material";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { TableMap } from "@tiptap/pm/tables";
import { useEffect, useReducer } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconColumnRemove,
} from "@tabler/icons-react";
import { useThemeStore } from "../../../zustand/useThemeStore";

/** Column rect, relative to the table node view wrapper. */
export interface ColumnRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ColumnState {
  columnIndex: number;
  tablePos: number;
  map: TableMap;
  tableNode: Parameters<typeof TableMap.get>[0];
}

// ProseMirror returns the deepest node at a position (often a
// text node inside a `<p>`); climb up until we find a real cell.
function resolveCell(dom: Node | null): HTMLElement | null {
  let el: HTMLElement | null =
    dom instanceof HTMLElement ? dom : (dom?.parentElement ?? null);
  while (el && el.tagName !== "TD" && el.tagName !== "TH") {
    el = el.parentElement;
  }
  return el;
}

/**
 * Live column context for the active table: the column under
 * the caret and its bounding rect.
 *
 * The selector is pure ProseMirror state (no DOM); the effect
 * measures DOM rects outside React's render cycle and caches
 * them per column so the host can keep the previous column
 * anchored during its exit animation.
 */
export function useTableColumnRect(editor: Editor): {
  columnIndex: number | null;
  rect: ColumnRect | null;
} {
  const currentState = useEditorState({
    editor,
    selector: (ctx) => {
      if (ctx.editor.isDestroyed) return null;
      if (!ctx.editor.isEditable) return null;

      const { $from } = ctx.editor.state.selection;

      let tableDepth = -1;
      let cellDepth = -1;

      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name === "table") {
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

      const tableNode = $from.node(tableDepth);
      const tablePos = $from.before(tableDepth);
      const cellPosInTable = $from.before(cellDepth) - tablePos - 1;
      if (cellPosInTable < 0) return null;

      const map = TableMap.get(tableNode);
      let cellRect: ReturnType<TableMap["findCell"]> | null = null;
      try {
        cellRect = map.findCell(cellPosInTable);
      } catch {
        return null;
      }

      return {
        columnIndex: cellRect.left,
        tablePos,
        map,
        tableNode,
      } satisfies ColumnState | null;
    },
  });

  const [rectsByColumn, setRectsByColumn] = useReducer(
    (
      state: Record<number, ColumnRect>,
      action: { key: number; value: ColumnRect },
    ): Record<number, ColumnRect> => {
      const previous = state[action.key];
      if (
        previous &&
        previous.left === action.value.left &&
        previous.top === action.value.top &&
        previous.width === action.value.width
      ) {
        return state;
      }
      return { ...state, [action.key]: action.value };
    },
    {},
  );

  useEffect(() => {
    if (currentState === null) return;
    if (editor.isDestroyed) return;
    const view = editor.view;
    if (!view || !view.dom) return;

    const { map, tableNode, tablePos, columnIndex } = currentState;

    // Anchor on the table node view wrapper.
    const cellPos = map.positionAt(0, columnIndex, tableNode);
    let firstDom: Node | null = null;
    try {
      firstDom = view.nodeDOM(tablePos + 1 + cellPos);
    } catch {
      return;
    }
    const firstCell = resolveCell(firstDom);
    if (!firstCell) return;

    const anchor = (firstCell.closest(".table-nodeview") ?? view.dom) as
      | HTMLElement
      | undefined;
    if (!anchor) return;
    const anchorRect = anchor.getBoundingClientRect();

    // Union of every cell in the column (handles merged cells).
    const rects: DOMRect[] = [];
    for (let row = map.height - 1; row >= 0; row -= 1) {
      const cp = map.positionAt(row, columnIndex, tableNode);
      let d: Node | null = null;
      try {
        d = view.nodeDOM(tablePos + 1 + cp);
      } catch {
        continue;
      }
      const ce = resolveCell(d);
      if (ce) rects.push(ce.getBoundingClientRect());
    }
    if (rects.length === 0) return;

    const left = Math.min(...rects.map((r) => r.left)) - anchorRect.left;
    const right = Math.max(...rects.map((r) => r.right)) - anchorRect.left;
    const top = Math.min(...rects.map((r) => r.top)) - anchorRect.top;
    const bottom = Math.max(...rects.map((r) => r.bottom)) - anchorRect.top;

    setRectsByColumn({
      key: columnIndex,
      value: {
        left,
        top,
        width: right - left,
        height: bottom - top,
      },
    });
  }, [currentState, editor]);

  const columnIndex = currentState?.columnIndex ?? null;
  const rect: ColumnRect | null =
    columnIndex !== null ? (rectsByColumn[columnIndex] ?? null) : null;

  return { columnIndex, rect };
}

/**
 * Presentational column-menu buttons. `TableColumnMenuHost`
 * anchors this inside an absolute box and wraps it with
 * `Collapse`.
 */
export const ColumnMenuButtons: React.FC<{ editor: Editor }> = ({ editor }) => {
  const { theme } = useThemeStore();

  function getColumnInfo(): {
    tableNode: Parameters<typeof TableMap.get>[0];
    tablePos: number;
    map: TableMap;
    cellRect: ReturnType<TableMap["findCell"]>;
  } | null {
    const { state } = editor;
    const { $from } = state.selection;

    let tableDepth = -1;
    let cellDepth = -1;

    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name === "table") {
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

    const tableNode = $from.node(tableDepth);
    const tablePos = $from.before(tableDepth);
    const cellPosInTable = $from.before(cellDepth) - tablePos - 1;
    if (cellPosInTable < 0) return null;

    const map = TableMap.get(tableNode);
    let cellRect: ReturnType<TableMap["findCell"]> | null = null;
    try {
      cellRect = map.findCell(cellPosInTable);
    } catch {
      return null;
    }

    return { tableNode, tablePos, map, cellRect };
  }

  function moveColumn(direction: -1 | 1): void {
    const info = getColumnInfo();
    if (!info) return;

    const currentCol = info.cellRect.left;
    const targetCol = currentCol + direction;

    if (targetCol < 0 || targetCol >= info.map.width) return;

    const rows = info.tableNode.content.content.slice();
    const newRows = rows.map((row) => {
      const cells = row.content.content;
      if (cells.length <= Math.max(currentCol, targetCol)) return row;
      const swapped = cells.slice();
      [swapped[currentCol], swapped[targetCol]] = [
        swapped[targetCol],
        swapped[currentCol],
      ];
      return row.type.create(row.attrs, swapped, row.marks);
    });

    const newTable = info.tableNode.type.create(
      info.tableNode.attrs,
      newRows,
      info.tableNode.marks,
    );

    const newMap = TableMap.get(newTable);
    const targetCellPos = newMap.positionAt(
      info.cellRect.top,
      targetCol,
      newTable,
    );

    const selectionPos = info.tablePos + 1 + targetCellPos;
    const tr = editor.state.tr.replaceWith(
      info.tablePos,
      info.tablePos + info.tableNode.nodeSize,
      newTable,
    );
    tr.setSelection(TextSelection.near(tr.doc.resolve(selectionPos)));

    editor.view.dispatch(tr);
    editor.view.focus();
  }

  const info = getColumnInfo();
  const canMoveLeft = !!info && info.cellRect.left > 0;
  const canMoveRight = !!info && info.cellRect.left < info.map.width - 1;

  return (
    <Paper
      elevation={18}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 50,
        p: 1,
        backgroundColor: theme.palette.background.paper,
        width: "max-content",
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <Tooltip title="Move column left">
          <span>
            <IconButton
              size="small"
              onClick={() => moveColumn(-1)}
              disabled={!canMoveLeft}
            >
              <IconArrowLeft size={18} />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Move column right">
          <span>
            <IconButton
              size="small"
              onClick={() => moveColumn(1)}
              disabled={!canMoveRight}
            >
              <IconArrowRight size={18} />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Remove current column">
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              disabled={!editor.can().chain().focus().deleteColumn().run()}
            >
              <IconColumnRemove size={18} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Paper>
  );
};
