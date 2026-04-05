import { IconButton, Stack, Tooltip } from "@mui/material";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { useThemeStore } from "../../../../zustand/useThemeStore";
import WestIcon from "@mui/icons-material/West";
import EastIcon from "@mui/icons-material/East";
import VerticalAlignTopIcon from "@mui/icons-material/VerticalAlignTop";
import VerticalAlignBottomIcon from "@mui/icons-material/VerticalAlignBottom";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import TableRowsIcon from "@mui/icons-material/TableRows";

interface TablePinnedMenuProps {
  editor: Editor;
  enabled?: boolean;
}

export const TablePinnedMenu = ({
  editor,
  enabled = true,
}: TablePinnedMenuProps) => {
  const { theme } = useThemeStore();

  const inTable = editor.isActive("table");

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 10, flip: true }}
      shouldShow={() =>
        enabled && editor.isEditable && editor.isActive("table")
      }
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          padding: 0.75,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
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
              disabled={!editor.can().chain().focus().deleteColumn().run()}
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
              disabled={!editor.can().chain().focus().deleteRow().run()}
            >
              <TableRowsIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </BubbleMenu>
  );
};
