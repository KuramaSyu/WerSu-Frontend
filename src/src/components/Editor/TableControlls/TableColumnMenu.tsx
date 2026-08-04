import { Box, Collapse, Stack } from "@mui/material";
import type { Editor } from "@tiptap/core";
import { M2 } from "../../../statics";
import {
  ColumnMenuButtons,
  useTableColumnRect,
} from "./TableColumnMenu.hooks.tsx";

/**
 * Floating column-menu layer. Anchors `ColumnMenuButtons` above
 * the active column; the `Collapse` drives enter/exit.
 *
 * `key={columnIndex}` forces a fresh `Collapse` per column so
 * each change replays both exit and enter animations.
 */
export const TableColumnMenuHost: React.FC<{
  editor: Editor;
  menuVisible: boolean;
  onMouseEnterMenu: () => void;
  onMouseLeaveMenu: () => void;
}> = ({ editor, menuVisible, onMouseEnterMenu, onMouseLeaveMenu }) => {
  const { columnIndex, rect } = useTableColumnRect(editor);

  // Always render the wrapper so the `Collapse` can play its
  // exit transition when `menuVisible` flips to false.
  const hasRect = columnIndex !== null && rect !== null;
  const visible = menuVisible && hasRect;

  if (!hasRect || columnIndex === null || rect === null) {
    return null;
  }

  // Bottom edge sits 8 px above the column's top edge. The
  // height of the menu is dynamic, so we shift up by the menu's
  // own height with `translate(..., -100%)` instead of
  // subtracting pixels.
  const cx = rect.left + rect.width / 2;
  const top = rect.top - 8;

  return (
    <Box
      key={columnIndex}
      data-table-column-menu
      onMouseEnter={onMouseEnterMenu}
      onMouseLeave={onMouseLeaveMenu}
      sx={{
        position: "absolute",
        top: `${top}px`,
        left: `${cx}px`,
        transform: "translate(-50%, -100%)",
        zIndex: 1300,
        width: "max-content",
      }}
    >
      <Collapse in={visible} timeout={200} mountOnEnter unmountOnExit appear>
        <Stack
          direction="row"
          spacing={0}
          sx={{
            alignItems: "center",
            padding: M2,
            position: "relative",
          }}
        >
          <ColumnMenuButtons editor={editor} />
        </Stack>
      </Collapse>
    </Box>
  );
};

export default TableColumnMenuHost;
