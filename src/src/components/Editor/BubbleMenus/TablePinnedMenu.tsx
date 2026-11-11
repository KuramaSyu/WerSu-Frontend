import { IconButton, Stack, Tooltip } from "@mui/material";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useThemeStore } from "../../../zustand/useThemeStore";
import WestIcon from "@mui/icons-material/West";
import EastIcon from "@mui/icons-material/East";
import VerticalAlignTopIcon from "@mui/icons-material/VerticalAlignTop";
import VerticalAlignBottomIcon from "@mui/icons-material/VerticalAlignBottom";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import TableRowsIcon from "@mui/icons-material/TableRows";
import { BubbleMenuSurface } from "./BubbleMenuSurface";
import { useTextSelectionAnchor } from "./useBubbleMenuAnchor";
import { useEditorEditable } from "./useEditorEditable";

interface TablePinnedMenuProps {
  editor: Editor;
  enabled?: boolean;
}

/**
 * Pinned table toolbar: stays open anywhere inside a table, anchored to
 * the caret / current selection.
 */
export const TablePinnedMenu = ({
  editor,
  enabled = true,
}: TablePinnedMenuProps) => {
  const { theme } = useThemeStore();
  const editorEditable = useEditorEditable(editor);

  // Reactive so the menu follows entering / leaving a table.
  const { inTable, canDeleteColumn, canDeleteRow } = useEditorState({
    editor,
    selector: (ctx) => ({
      inTable: ctx.editor.isActive("table"),
      canDeleteColumn: ctx.editor.can().deleteColumn(),
      canDeleteRow: ctx.editor.can().deleteRow(),
    }),
  });

  const isOpen = enabled && editorEditable && inTable;
  const anchor = useTextSelectionAnchor(editor, isOpen);

  return (
    <BubbleMenuSurface
      open={isOpen}
      anchor={anchor}
      placement="top"
      offset={10}
      flip
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          padding: 0.75,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        <Tooltip title="Add column at left">
          <span>
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              disabled={!inTable}
            >
              <WestIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Add column at right">
          <span>
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              disabled={!inTable}
            >
              <EastIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Remove current column">
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              disabled={!canDeleteColumn}
            >
              <ViewWeekIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Add row at top">
          <span>
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().addRowBefore().run()}
              disabled={!inTable}
            >
              <VerticalAlignTopIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Add row at bottom">
          <span>
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              disabled={!inTable}
            >
              <VerticalAlignBottomIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Remove current row">
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={() => editor.chain().focus().deleteRow().run()}
              disabled={!canDeleteRow}
            >
              <TableRowsIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </BubbleMenuSurface>
  );
};
