import {
  Box,
  useTheme,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Fade,
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
  useEditorState,
} from "@tiptap/react";
import { Table } from "@tiptap/extension-table";
import { TextSelection } from "@tiptap/pm/state";
import { useState } from "react";
import { useEditorMenuStore } from "../../../../zustand/editorMenuStore";

export const TableNodeView: React.FC<ReactNodeViewProps> = ({
  editor,
  getPos,
}) => {
  const [isTableHovered, setIsTableHovered] = useState(false);
  const [showAddRowControl, setShowAddRowControl] = useState(false);
  const [showAddColControl, setShowAddColControl] = useState(false);
  const theme = useTheme();
  // Shared menu state allows instant suppression when text BubbleMenu opens.
  const isTextSelectionMenuOpen = useEditorMenuStore(
    (state) => state.isTextSelectionMenuOpen,
  );
  // Global selection state from the editor.
  // We use this to suppress table hover controls while text is selected,
  // so the text-format BubbleMenu can take precedence (especially on double-click selection).
  const { hasSelection } = useEditorState({
    editor,
    selector: (ctx) => ({
      hasSelection: !ctx.editor.state.selection.empty,
    }),
  });
  // One shared flag to hide every hover-based table control immediately.
  const shouldHideTableControls = hasSelection || isTextSelectionMenuOpen;

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

  const handleTableMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    // keep controls when handlers iteself are hovered
    if (target.closest(".table-col-control")) {
      setShowAddColControl(true);
      return;
    }

    if (target.closest(".table-row-control")) {
      setShowAddRowControl(true);
      return;
    }

    const cell = target.closest("td, th") as HTMLTableCellElement | null;
    if (!cell) {
      setShowAddRowControl(false);
      setShowAddColControl(false);
      return;
    }

    const row = cell.parentElement as HTMLTableRowElement | null;
    const rowContainer = row?.parentElement;
    if (!row || !rowContainer) {
      setShowAddRowControl(false);
      setShowAddColControl(false);
      return;
    }

    const rows = Array.from(rowContainer.children).filter(
      (child) => child.tagName.toLowerCase() === "tr",
    ) as HTMLTableRowElement[];

    if (rows.length === 0) {
      setShowAddRowControl(false);
      setShowAddColControl(false);
      return;
    }

    const rowIndex = rows.indexOf(row);
    const isLastRow = rowIndex === rows.length - 1;
    const isLastCol = cell.cellIndex === row.cells.length - 1;

    setShowAddRowControl(isLastRow);
    setShowAddColControl(isLastCol);
  };

  return (
    <NodeViewWrapper
      className="table-nodeview"
      onMouseEnter={() => setIsTableHovered(true)}
      onMouseLeave={() => {
        setIsTableHovered(false);
        setShowAddRowControl(false);
        setShowAddColControl(false);
      }}
      onMouseMove={handleTableMouseMove}
      style={{
        position: "relative",
        marginBottom: "16px",
        overflow: "visible",
      }}
    >
      <Box
        sx={{
          // While text formatting UI is active, force all table hover controls hidden.
          ".table-nodeview:hover & .hoverBox": shouldHideTableControls
            ? {
                opacity: "0 !important",
                pointerEvents: "none !important",
                transition: "opacity 0.3s ease",
              }
            : {
                opacity: 1,
                zIndex: 10,
                pointerEvents: "auto",
                transition: "opacity 0.3s ease",
              },
          // "& .hoverBox:hover": shouldHideTableControls
          //   ? {
          //       opacity: "0 !important",
          //       pointerEvents: "none !important",
          //     }
          //   : {
          //       opacity: 1,
          //       pointerEvents: "auto",
          //     },

          // proper hiding of the table when not hovered
          "& .hoverBox": {
            opacity: shouldHideTableControls ? "0 !important" : 0,
            pointerEvents: shouldHideTableControls ? "none !important" : "none",
            transition: "opacity 0.3s ease",
          },
        }}
      >
        {/* Main hover controls - add/remove rows/columns */}
        <Stack
          className="hoverBox"
          direction="row"
          spacing={1}
          sx={{
            position: "absolute",
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
        <Fade in={isTableHovered && showAddColControl}>
          <Box className="table-col-control">
            <Button
              className="hoverBox"
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
          </Box>
        </Fade>

        {/* Row add */}
        <Fade in={isTableHovered && showAddRowControl}>
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
        </Fade>
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
