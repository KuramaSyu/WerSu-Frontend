import { IconButton, Box, useTheme, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Table } from '@tiptap/extension-table';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Padding } from '@mui/icons-material';

export const TableNodeView = ({ editor }: any) => {
  const theme = useTheme();

  return (
    <NodeViewWrapper
      className="table-nodeview"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* Column add */}
      <Box className="table-col-control">
        {Array.from({
          length: editor?.state.doc.firstChild?.childCount || 0,
        }).map((_, i) => (
          <Button
            key={i}
            size="small"
            onClick={() => editor.chain().focus().addColumnAfter(i).run()}
            sx={(theme) => ({
              width: '30px',
              height: '100%',
              minWidth: '0',
              padding: 0,
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
          size="small"
          onClick={() => editor.chain().focus().addRowAfter().run()}
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            flexGrow: 1,
          }}
        >
          <AddIcon fontSize="small" />
        </Button>
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
