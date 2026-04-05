import {
  Box,
  useTheme,
  Button,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import WestIcon from "@mui/icons-material/West";
import EastIcon from "@mui/icons-material/East";
import VerticalAlignTopIcon from "@mui/icons-material/VerticalAlignTop";
import VerticalAlignBottomIcon from "@mui/icons-material/VerticalAlignBottom";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import TableRowsIcon from "@mui/icons-material/TableRows";
import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { Table } from "@tiptap/extension-table";
import { TextSelection } from "@tiptap/pm/state";

export const TableNodeView: React.FC<ReactNodeViewProps> = ({
  editor,
  getPos,
}) => {
  const theme = useTheme();

  /**
   * Adds a column at the end of the hovered table
   * @returns
   */
  const addColumnAfter = () => {
    const pos = getPos();
    if (pos === undefined) return;

    // Move cursor into the table's last cell, then add column
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;

    // Get the last row's last cell position
    const lastRow = node.lastChild;
    if (!lastRow) return;

    const lastCellPos = pos + node.content.size - lastRow.lastChild!.nodeSize;
    const resolvedPos = editor.state.doc.resolve(lastCellPos);

    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.near(resolvedPos)),
    );
    editor.chain().focus().addColumnAfter().run();
  };

  /**
   * Adds a row at the end of the hovered table
   * @returns
   */
  const addRowAfter = () => {
    const pos = getPos();
    if (pos === undefined) return;

    // Move cursor into the table's last row, then add row
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;

    const lastRowPos = pos + node.content.size - node.lastChild!.nodeSize + 1;
    const resolvedPos = editor.state.doc.resolve(lastRowPos);

    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.near(resolvedPos)),
    );
    editor.chain().focus().addRowAfter().run();
  };
  return (
    <NodeViewWrapper
      className="table-nodeview"
      style={{
        position: "relative",
        display: "inline-block",
        marginBottom: "10px",
        overflow: "visible",
      }}
    >
      <Box
        sx={{
          ".table-nodeview:hover & .hoverBox": {
            opacity: 1,
            pointerEvents: "auto",
            transition: "opacity 0.3s ease",
          },
          "& .hoverBox:hover": {
            opacity: 1,
            pointerEvents: "auto",
          },
          "& .hoverBox": {
            opacity: 0,
            pointerEvents: "none",
            transition: "opacity 0.3s ease",
          },
        }}
      >
        <Stack
          className="hoverBox"
          direction="row"
          spacing={1}
          sx={{
            position: "absolute",
            left: 0,
            bottom: "calc(100% + 6px)",
            width: "max-content",
            padding: 0.75,
            borderRadius: 1,
            zIndex: 25,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            "&::after": {
              content: '""',
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              height: "10px",
            },
          }}
        >
          <Tooltip title="Add column at left">
            <span>
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
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

        {/* Column add */}
        <Box className="table-col-control">
          {Array.from({
            length: editor?.state.doc.firstChild?.childCount || 0,
          }).map((_, i) => (
            <Button
              className="hoverBox"
              key={i}
              size="small"
              onClick={addColumnAfter}
              sx={(theme) => ({
                position: "absolute",
                display: "flex",
                flexDirection: "column",
                top: 0,
                left: "100%",
                width: "30px",
                height: "100% !important",
                zIndex: 10,
                minWidth: "0",
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              })}
            >
              <AddIcon fontSize="small" />
            </Button>
          ))}
        </Box>

        {/* Row add */}
        <Box className="table-row-control">
          <Button
            className="hoverBox"
            size="small"
            onClick={() => addRowAfter()}
            sx={{
              position: "absolute",
              display: "flex",
              flexDirection: "row",
              bottom: -30,
              left: 0,
              width: "100% !important",
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              flexGrow: 1,
            }}
          >
            <AddIcon fontSize="small" />
          </Button>
        </Box>
      </Box>

      <NodeViewContent />
    </NodeViewWrapper>
  );
};

export const TableWithControls = Table.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TableNodeView);
  },
});
