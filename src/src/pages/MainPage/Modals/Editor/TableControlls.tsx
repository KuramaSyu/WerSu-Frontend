import { IconButton, Box, useTheme, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { NodeViewWrapper, NodeViewContent, Editor } from '@tiptap/react';
import { Table } from '@tiptap/extension-table';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Padding } from '@mui/icons-material';

export const TableNodeView = ({
  editor,
  getPos,
}: {
  editor: Editor;
  getPos: () => number;
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
      editor.state.tr.setSelection(
        editor.state.selection.constructor.near(resolvedPos)
      )
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
      editor.state.tr.setSelection(
        editor.state.selection.constructor.near(resolvedPos)
      )
    );
    editor.chain().focus().addRowAfter().run();
  };
  return (
    <NodeViewWrapper
      className="table-nodeview"
      style={{
        position: 'relative',
        display: 'inline-block',
        marginBottom: '10px',
      }}
    >
      <Box
        sx={{
          '.table-nodeview:hover & .hoverBox': {
            opacity: 1,
            pointerEvents: 'auto',
            transition: 'opacity 0.3s ease',
          },
          '& .hoverBox': {
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease',
          },
        }}
      >
        {/* Column add */}
        <Box className="table-col-control">
          {Array.from({
            length: editor?.state.doc.firstChild?.childCount || 0,
          }).map((_, i) => (
            <Button
              className="hoverBox"
              key={i}
              size="small"
              onClick={() => addColumnAfter(i)}
              sx={(theme) => ({
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                top: 0,
                left: '100%',
                width: '30px',
                height: '100% !important',
                zIndex: 10,
                minWidth: '0',
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
              position: 'absolute',
              display: 'flex',
              flexDirection: 'row',
              bottom: -30,
              left: 0,
              width: '100% !important',
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
