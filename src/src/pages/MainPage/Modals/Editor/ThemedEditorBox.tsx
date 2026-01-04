import { Box, darken, lighten } from '@mui/material';
import { M1, M2 } from '../../../../statics';
import { CodeBlockThemer } from './CodeBlockThemer';

export const ThemedEditorBox = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <Box
      sx={(theme) => ({
        //backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        //border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        // p: M2,
        my: theme.spacing(2), // spacing top and bottom
        mr: theme.spacing(2), // spacing right

        // Disable the border around the editor
        '& .ProseMirror': {
          outline: 'none',
        },

        '& .tiptap': {
          // table header background
          '--gray-1': theme.palette.muted.main,
          '--gray-2': theme.palette.action.selected,
          // border of tables
          '--gray-3': theme.palette.divider,

          '--purple': theme.palette.primary.main,

          // give the outer table border the same thickness
          '& div[data-node-view-content-react]': {
            border: '1px solid var(--gray-3)',
          },

          '& th, & td': {
            border: '1px solid var(--gray-3)',
            padding: `0 ${M2}`,
          },

          '& th': {
            backgroundColor: 'var(--gray-1)',
            fontWeight: 600,
          },

          '& code': {
            backgroundColor: theme.palette.background.paper,
            color: lighten(theme.palette.secondary.main, 0.2),
            padding: theme.spacing(0.25, 0.5),
            borderRadius: theme.shape.borderRadius,
          },
        },
      })}
    >
      <CodeBlockThemer className="tiptap">{children}</CodeBlockThemer>
    </Box>
  );
};
