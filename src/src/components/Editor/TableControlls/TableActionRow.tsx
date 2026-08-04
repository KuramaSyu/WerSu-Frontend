import { IconButton, Paper, Stack, Tooltip } from "@mui/material";
import React from "react";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { TableMap } from "@tiptap/pm/tables";
import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconRowInsertTop,
  IconRowInsertBottom,
  IconRowRemove,
  IconArrowUp,
  IconArrowDown,
} from "@tabler/icons-react";
import { useThemeStore } from "../../../zustand/useThemeStore";

interface TableActionRowProps {
  editor: Editor;
}

/**
 * Row + column action toolbar for the active table. Styled to
 * match `TableColumnMenu` (round-corner paper, icon buttons with
 * tooltips). Shown above the table by `TableControlls` once a cell
 * has been clicked.
 */
export function TableActionRow({
  editor,
}: TableActionRowProps): React.ReactElement {
  const { theme } = useThemeStore();

  /** Add a row before the current row. */
  function addRowBefore(): void {
    editor.chain().focus().addRowBefore().run();
  }

  /** Add a row after the current row. */
  function addRowAfter(): void {
    editor.chain().focus().addRowAfter().run();
  }

  /** Add a column before the current column. */
  function addColumnBefore(): void {
    editor.chain().focus().addColumnBefore().run();
  }

  /** Add a column after the current column. */
  function addColumnAfter(): void {
    editor.chain().focus().addColumnAfter().run();
  }

  /** Delete the current row. */
  function deleteRow(): void {
    editor.chain().focus().deleteRow().run();
  }

  /**
   * Resolve the table and row context for the current selection.
   */
  function getRowInfo(): {
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

      if (tableDepth !== -1 && cellDepth !== -1) {
        break;
      }
    }

    if (tableDepth === -1 || cellDepth === -1) {
      return null;
    }

    const tableNode = $from.node(tableDepth);
    const tablePos = $from.before(tableDepth);
    const cellPosInTable = $from.before(cellDepth) - tablePos - 1;
    if (cellPosInTable < 0) {
      return null;
    }

    const map = TableMap.get(tableNode);
    let cellRect: ReturnType<TableMap["findCell"]> | null = null;
    try {
      cellRect = map.findCell(cellPosInTable);
    } catch {
      return null;
    }

    return {
      tableNode,
      tablePos,
      map,
      cellRect,
    };
  }

  /**
   * Move the current row up or down by swapping row positions.
   */
  function moveRow(direction: -1 | 1): void {
    const info = getRowInfo();
    if (!info) return;

    const currentRow = info.cellRect.top;
    const targetRow = currentRow + direction;

    if (targetRow < 0 || targetRow >= info.map.height) {
      return;
    }

    const rows = info.tableNode.content.content.slice();
    [rows[currentRow], rows[targetRow]] = [rows[targetRow], rows[currentRow]];

    const newTable = info.tableNode.type.create(
      info.tableNode.attrs,
      rows,
      info.tableNode.marks,
    );

    const newMap = TableMap.get(newTable);
    const targetCellPos = newMap.positionAt(
      targetRow,
      info.cellRect.left,
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

  /** Move the current row up by one. */
  function moveRowUp(): void {
    moveRow(-1);
  }

  /** Move the current row down by one. */
  function moveRowDown(): void {
    moveRow(1);
  }

  const rowInfo = getRowInfo();
  const canMoveUp = !!rowInfo && rowInfo.cellRect.top > 0;
  const canMoveDown =
    !!rowInfo && rowInfo.cellRect.top < rowInfo.map.height - 1;

  return (
    <Paper
      elevation={18}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 50,
        p: 1,
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        {/* Add row before */}
        <Tooltip title="Add row at top">
          <span>
            <IconButton
              size="small"
              onClick={addRowBefore}
              disabled={!editor.can().chain().focus().addRowBefore().run()}
            >
              <IconRowInsertTop size={18} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Add row after */}
        <Tooltip title="Add row at bottom">
          <span>
            <IconButton
              size="small"
              onClick={addRowAfter}
              disabled={!editor.can().chain().focus().addRowAfter().run()}
            >
              <IconRowInsertBottom size={18} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Add column before */}
        <Tooltip title="Add column at left">
          <span>
            <IconButton
              size="small"
              onClick={addColumnBefore}
              disabled={!editor.can().chain().focus().addColumnBefore().run()}
            >
              <IconColumnInsertLeft size={18} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Add column after */}
        <Tooltip title="Add column at right">
          <span>
            <IconButton
              size="small"
              onClick={addColumnAfter}
              disabled={!editor.can().chain().focus().addColumnAfter().run()}
            >
              <IconColumnInsertRight size={18} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Delete row */}
        <Tooltip title="Remove current row">
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={deleteRow}
              disabled={!editor.can().chain().focus().deleteRow().run()}
            >
              <IconRowRemove size={18} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Move row up */}
        <Tooltip title="Move row up">
          <span>
            <IconButton size="small" onClick={moveRowUp} disabled={!canMoveUp}>
              <IconArrowUp size={18} />
            </IconButton>
          </span>
        </Tooltip>

        {/* Move row down */}
        <Tooltip title="Move row down">
          <span>
            <IconButton
              size="small"
              onClick={moveRowDown}
              disabled={!canMoveDown}
            >
              <IconArrowDown size={18} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

export default TableActionRow;
