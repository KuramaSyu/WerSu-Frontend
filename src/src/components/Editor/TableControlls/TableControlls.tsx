import { Box, useTheme, Button, Fade, Stack } from "@mui/material";
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
import { useEditorMenuStore } from "../../../zustand/editorMenuStore";
import { M2 } from "../../../statics";
import { ActionRow } from "./ActionRow";
import { IconPlus as AddIcon } from "@tabler/icons-react";

/**
 * Table node view with controls (moved into `TableControlls` folder).
 */
export const TableNodeView: React.FC<ReactNodeViewProps> = ({
  editor,
  getPos,
}) => {
  const [isTableHovered, setIsTableHovered] = useState(false);
  const [showAddRowControl, setShowAddRowControl] = useState(false);
  const [showAddColControl, setShowAddColControl] = useState(false);
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
      {/* table controlls */}
      <Box
        sx={{
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
          "& .hoverBox": {
            opacity: shouldHideTableControls ? "0 !important" : 0,
            pointerEvents: shouldHideTableControls ? "none !important" : "none",
            transition: "opacity 0.3s ease",
          },
        }}
      >
        <Stack
          className="hoverBox"
          direction="row"
          spacing={0.75}
          sx={{
            alignItems: "center",
            position: "absolute",
            bottom: "calc(100% + 6px)",
            width: "max-content",
            padding: M2,
            zIndex: 25,
            // backgroundColor: "transparent",
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
          {editor.isEditable && <ActionRow editor={editor} />}
        </Stack>

        {/* add column side button */}
        <Fade in={isTableHovered && showAddColControl && editor.isEditable}>
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
              <AddIcon />
            </Button>
          </Box>
        </Fade>

        {/* add row bottom button */}
        <Fade in={isTableHovered && showAddRowControl && editor.isEditable}>
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
});

export default TableWithControls;

const CssOverrideForImageCellsBox: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <Box
      // force image to use width = 100%
      sx={{
        "& td img, & th img": {
          width: "100%",
        },
      }}
    >
      {children}
    </Box>
  );
};
