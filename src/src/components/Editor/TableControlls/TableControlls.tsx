import { Box, Button, Collapse, Fade, Stack, useTheme } from "@mui/material";
import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
  useEditorState,
} from "@tiptap/react";
import { Table } from "@tiptap/extension-table";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconPlus as AddIcon } from "@tabler/icons-react";
import { useEditorMenuStore } from "../../../zustand/editorMenuStore";
import { M2 } from "../../../statics";
import { TableActionRow } from "./TableActionRow";
import { TableColumnMenuHost } from "./TableColumnMenu";
import { useTableColumnRect } from "./TableColumnMenu.hooks.tsx";

// Grace period before the menus hide after the cursor leaves
// the table. Lets the user cross the gap to the column menu.
const CELL_CLICKED_HIDE_DELAY_MS = 200;

/**
 * Per-cell text assembly.
 *
 * `extension-table`'s stock `renderTableToMarkdown` runs `collapseWhitespace`
 * on each cell, which collapses line breaks into single spaces. That's fine
 * for plain prose but loses the line structure when a cell holds a list
 * (`- a / - b / - c`), ordered list, multiple paragraphs, etc. We assemble
 * the cell text ourselves: render each block-level child separately, join
 * the lines with `<br/>` so the markdown source keeps the line breaks, then
 * collapse only the *intra*-line whitespace. `|` is backslash-escaped so
 * marked's cell splitter does not split cells that happen to contain a
 * literal pipe character.
 *
 * Uses `h.renderChild` (not `h.renderChildren`): `renderChildren` flattens
 * a node's `.content` into siblings with the parent's separator, which
 * silently drops the list's own `\n`-separator logic when the cell only
 * holds a single block-level child like a `bulletList`. `renderChild`
 * routes through the child's own `renderMarkdown` instead, so the list
 * renders its items with `\n` and we can collapse that to `<br/>`.
 */
function assembleCellText(
  h: { renderChild: (n: unknown, i: number) => string },
  content: unknown,
): string {
  const children = Array.isArray(content) ? content : content ? [content] : [];
  if (children.length === 0) return "";
  // Render each block-level child of the cell. A child may itself be a
  // multi-line structure (a bullet list, ordered list, multiple
  // paragraphs, ...). Split its rendered output on newline so each
  // logical line becomes a separate "<br/>"-joined cell line.
  const lines: string[] = [];
  for (let i = 0; i < children.length; i += 1) {
    const raw = h.renderChild(children[i], i);
    for (const part of raw.split(/\r?\n/)) {
      const cleaned = part.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
      if (cleaned.length > 0) lines.push(cleaned);
    }
  }
  return lines.join("<br/>");
}

/**
 * Reimplementation of the table layout that ships inside
 * `extension-table@3.26.x`. We can't reuse the stock `renderTableToMarkdown`
 * because its `collapseWhitespace` step kills the line breaks our cell text
 * assembly just preserved. The shape (header row, separator row, body rows
 * with padded cells) matches what `extension-table` produces so the
 * round-trip parses the result back identically.
 */
function renderWerSuTable(
  node: {
    content?: Array<{
      content?: Array<{
        type: string;
        attrs?: Record<string, unknown>;
        content?: unknown;
      }>;
    }> | null;
  },
  h: { renderChild?: (n: unknown, i: number) => string },
): string {
  if (!node.content || node.content.length === 0) return "";
  type Row = { text: string; isHeader: boolean }[];
  const rows: Row[] = [];
  for (const rowNode of node.content) {
    const cells: Row = [];
    if (rowNode.content) {
      for (const cellNode of rowNode.content) {
        cells.push({
          text: assembleCellText(
            { renderChild: h.renderChild ?? (() => "") },
            cellNode.content,
          ),
          isHeader: cellNode.type === "tableHeader",
        });
      }
    }
    rows.push(cells);
  }
  const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  if (columnCount === 0) return "";
  const colWidths: number[] = new Array(columnCount).fill(0);
  for (const r of rows) {
    for (let i = 0; i < columnCount; i += 1) {
      const t = r[i]?.text || "";
      colWidths[i] = Math.max(colWidths[i], t.length, 3);
    }
  }
  const pad = (s: string, w: number) =>
    s + " ".repeat(Math.max(0, w - s.length));
  const headerRow = rows[0];
  const hasHeader = headerRow.some((c) => c.isHeader);
  let out = "\n";
  const headerTexts = new Array(columnCount)
    .fill(0)
    .map((_, i) => (hasHeader ? headerRow[i]?.text || "" : ""));
  out += `| ${headerTexts.map((t, i) => pad(t, colWidths[i])).join(" | ")} |\n`;
  out += `| ${colWidths.map((w) => "-".repeat(Math.max(3, w))).join(" | ")} |\n`;
  const body = hasHeader ? rows.slice(1) : rows;
  for (const r of body) {
    out += `| ${new Array(columnCount)
      .fill(0)
      .map((_, i) => pad(r[i]?.text || "", colWidths[i]))
      .join(" | ")} |\n`;
  }
  return out;
}

export const TableNodeView: React.FC<ReactNodeViewProps> = ({
  editor,
  getPos,
}) => {
  const [isTableHovered, setIsTableHovered] = useState(false);
  const [showAddRowControl, setShowAddRowControl] = useState(false);
  const [showAddColControl, setShowAddColControl] = useState(false);
  const [cellClicked, setCellClicked] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const actionRowRef = useRef<HTMLDivElement | null>(null);
  const [actionRowWidth, setActionRowWidth] = useState(0);
  const [tableWidth, setTableWidth] = useState(0);
  // Bumped on every false->true transition of `showActionRow` so
  // the `Collapse` remounts and replays its enter animation each
  // time the menu re-appears. Without this, repeated show/hide
  // cycles skip the animation after the first one.
  const [actionRowAppearanceId, setActionRowAppearanceId] = useState(0);
  const [prevShowActionRow, setPrevShowActionRow] = useState(false);
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
  const showActionRow =
    cellClicked && editor.isEditable && !shouldHideTableControls;
  if (showActionRow !== prevShowActionRow) {
    setPrevShowActionRow(showActionRow);
    if (showActionRow) {
      setActionRowAppearanceId((id) => id + 1);
    }
  }

  // Debounced hide: schedule a reset, but cancel if the cursor
  // re-enters the table or the column menu within the window.
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHideCellClicked = () => {
    if (hideTimerRef.current !== null) return;
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setCellClicked(false);
    }, CELL_CLICKED_HIDE_DELAY_MS);
  };

  const cancelHideCellClicked = () => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // Track wrapper width so the action row can be positioned within the table bounds.
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setTableWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTableWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Measure the action row once it mounts.
  useLayoutEffect(() => {
    const el = actionRowRef.current;
    if (!el || !showActionRow) return;
    const width = el.offsetWidth;
    if (width > 0) setActionRowWidth(width);
  }, [showActionRow]);

  // Active column's rect (relative to the wrapper) anchors the column menu.
  const { rect: columnRect } = useTableColumnRect(editor);

  // Estimated width of the column menu (3 small IconButtons + Paper p:1 + Stack M2 padding).
  // The menu content is stable, so a hardcoded estimate is reliable enough for collision avoidance.
  const COLUMN_MENU_ESTIMATED_WIDTH = 180;

  // Find a horizontal slot for the action row that doesn't overlap the column menu.
  // Both menus sit in the same horizontal band above the table.
  let actionRowLeft = 0;
  if (tableWidth > 0 && actionRowWidth > 0 && columnRect) {
    const cx = columnRect.left + columnRect.width / 2;
    const menuLeft = cx - COLUMN_MENU_ESTIMATED_WIDTH / 2;
    const menuRight = cx + COLUMN_MENU_ESTIMATED_WIDTH / 2;
    const rightLeft = tableWidth - actionRowWidth;

    if (rightLeft >= 0 && rightLeft >= menuRight) {
      // Right edge is clear of the menu.
      actionRowLeft = rightLeft;
    } else if (actionRowWidth <= menuLeft) {
      // Left edge is clear of the menu.
      actionRowLeft = 0;
    } else if (menuLeft - actionRowWidth >= 0) {
      // Snug fit just left of the menu.
      actionRowLeft = menuLeft - actionRowWidth;
    } else if (menuRight + actionRowWidth <= tableWidth) {
      // Snug fit just right of the menu.
      actionRowLeft = menuRight;
    } else {
      // No clean fit; pick the side with less overlap.
      const rightOverlap = Math.max(0, menuLeft - rightLeft);
      const leftOverlap = Math.max(0, menuRight - actionRowWidth);
      actionRowLeft = rightOverlap <= leftOverlap ? Math.max(0, rightLeft) : 0;
    }
  }

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

  const handleTableClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("td, th")) {
      setCellClicked(true);
    }
  };

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className="table-nodeview"
      onMouseEnter={() => {
        setIsTableHovered(true);
        cancelHideCellClicked();
      }}
      onMouseLeave={(event: React.MouseEvent<HTMLDivElement>) => {
        setIsTableHovered(false);
        setShowAddRowControl(false);
        setShowAddColControl(false);
        // Don't schedule a hide if the cursor is moving to the
        // column menu (the menu sits above the wrapper).
        const related = event.relatedTarget as HTMLElement | null;
        if (related?.closest("[data-table-column-menu]")) {
          return;
        }
        scheduleHideCellClicked();
      }}
      onMouseMove={(event: React.MouseEvent<HTMLDivElement>) => {
        handleTableMouseMove(event);
        cancelHideCellClicked();
      }}
      onClick={handleTableClick}
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
        <Box
          ref={actionRowRef}
          sx={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: `${actionRowLeft}px`,
            width: "max-content",
            zIndex: 25,
            pointerEvents: showActionRow ? "auto" : "none",
            transition: theme.transitions.create("left"),
          }}
        >
          <Collapse
            key={actionRowAppearanceId}
            in={showActionRow}
            timeout={theme.transitions.duration.enteringScreen}
            mountOnEnter
            unmountOnExit
            appear
          >
            <Stack
              direction="row"
              spacing={0}
              sx={{
                alignItems: "center",
                padding: M2,
                position: "relative",
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
              <TableActionRow editor={editor} />
            </Stack>
          </Collapse>
        </Box>

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

      {/* column menu sits at the wrapper root so its absolute
          positioning is anchored to the wrapper, not the
          controls box. */}
      {editor.isEditable && (
        <TableColumnMenuHost
          editor={editor}
          menuVisible={cellClicked}
          onMouseEnterMenu={cancelHideCellClicked}
          onMouseLeaveMenu={scheduleHideCellClicked}
        />
      )}
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
