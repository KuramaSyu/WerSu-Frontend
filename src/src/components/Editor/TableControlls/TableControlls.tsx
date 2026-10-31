import { Box, Button, Fade, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
  useEditorState,
} from "@tiptap/react";
import { Table } from "@tiptap/extension-table";
import { TextSelection } from "@tiptap/pm/state";
import { useRef, useState } from "react";
import { IconPlus as AddIcon } from "@tabler/icons-react";
import { useEditorMenuStore } from "../../../zustand/editorMenuStore";
import { renderWerSuTable } from "../../../utils/converters/toMarkdown/renderTableToMarkdown";

// Action row + column menu are disabled: the bubble menu now
// owns add/remove/move for rows and columns, so the legacy
// hover toolbars are no longer rendered. The component files
// (TableActionRow, TableColumnMenuHost, TableColumnMenu.hooks)
// are kept around in case we need to wire them back.

export const TableNodeView: React.FC<ReactNodeViewProps> = ({
  editor,
  getPos,
}) => {
  const [isTableHovered, setIsTableHovered] = useState(false);
  const [showAddRowControl, setShowAddRowControl] = useState(false);
  const [showAddColControl, setShowAddColControl] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();
  const isTextSelectionMenuOpen = useEditorMenuStore(
    (state) => state.isTextSelectionMenuOpen,
  );
  const { hasSelection } = useEditorState({
    editor,
    selector: (ctx) => ({
      hasSelection: !ctx.editor.state.selection.empty,
    }),
  });
  const shouldHideTableControls = hasSelection || isTextSelectionMenuOpen;

  const addColumnAfter = () => {
    const pos = getPos();
    if (pos === undefined) return;

    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;

    const lastRow = node.lastChild;
    if (!lastRow) return;

    const lastCellPos = pos + node.content.size - lastRow.lastChild!.nodeSize;
    const resolvedPos = editor.state.doc.resolve(lastCellPos);

    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.near(resolvedPos)),
    );
    editor.chain().focus().addColumnAfter().run();
  };

  const addRowAfter = () => {
    const pos = getPos();
    if (pos === undefined) return;

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
      ref={wrapperRef}
      className="table-nodeview"
      onMouseEnter={() => {
        setIsTableHovered(true);
      }}
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
          ".table-nodeview:hover & .hoverBox": shouldHideTableControls
            ? {
                opacity: "0 !important",
                pointerEvents: "none !important",
                transition: "opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }
            : {
                opacity: 1,
                zIndex: 10,
                pointerEvents: "auto",
                transition: "opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              },
          "& .hoverBox": {
            opacity: shouldHideTableControls ? "0 !important" : 0,
            pointerEvents: shouldHideTableControls ? "none !important" : "none",
            transition: "opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          },
        }}
      >
        {/* add column side button */}
        <Fade
          in={isTableHovered && showAddColControl && editor.isEditable}
          easing={theme.transitions.easing.easeInOut}
          timeout={200}
        >
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
                width: "24px",
                height: "100% !important",
                zIndex: 10,
                minWidth: "0",
                backgroundColor: alpha(theme.palette.background.paper, 0.5),
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                "&:hover": {
                  borderRadius: 1,
                  backgroundColor: alpha(theme.palette.background.paper, 0.5),
                },
              })}
            >
              <AddIcon />
            </Button>
          </Box>
        </Fade>

        {/* add row bottom button */}
        <Fade
          in={isTableHovered && showAddRowControl && editor.isEditable}
          easing={theme.transitions.easing.easeInOut}
          timeout={200}
        >
          <Box className="table-row-control">
            <Button
              className="hoverBox"
              size="small"
              onClick={() => addRowAfter()}
              sx={{
                position: "absolute",
                display: "flex",
                flexDirection: "row",
                bottom: -24,
                left: 0,
                width: "100% !important",
                height: "24px !important",
                backgroundColor: alpha(theme.palette.background.paper, 0.5),
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                "&:hover": {
                  borderRadius: 1,
                  backgroundColor: alpha(theme.palette.background.paper, 0.5),
                },
                flexGrow: 1,
              }}
            >
              <AddIcon />
            </Button>
          </Box>
        </Fade>
      </Box>
      <CssOverrideForImageCellsBox>
        <NodeViewContent />
      </CssOverrideForImageCellsBox>
    </NodeViewWrapper>
  );
};

export const TableWithControls = Table.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TableNodeView);
  },
  renderMarkdown: (node, h) => {
    return renderWerSuTable(node as never, h as never);
  },
});

export default TableWithControls;

const CssOverrideForImageCellsBox: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <Box sx={{ "& td img, & th img": { width: "100%" } }}>{children}</Box>;
};
