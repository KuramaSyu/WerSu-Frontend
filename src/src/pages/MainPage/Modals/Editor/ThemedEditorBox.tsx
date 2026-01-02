import { Box } from '@mui/material';

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
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        padding: 2,

        // // ProseMirror content styling
        // '& .ProseMirror': {
        //   outline: 'none',
        // },

        // // Table styling (important for Tiptap)
        // '& .ProseMirror table': {
        //   borderCollapse: 'collapse',
        //   width: '100%',
        // },
        // '& .ProseMirror th, & .ProseMirror td': {
        //   border: `1px solid white`,
        //   padding: '6px 8px',
        // },
        // '& .ProseMirror th': {
        //   fontWeight: 600,
        //   backgroundColor: theme.palette.action.hover,
        // },
        '& .tiptap': {
          '--gray-1': theme.palette.action.hover,
          '--gray-2': theme.palette.action.selected,
          '--gray-3':
            theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.6)'
              : 'rgba(0,0,0,0.6)',
          '--purple': theme.palette.primary.main,

          '& table': {
            borderCollapse: 'collapse',
            width: '100%',
          },

          '& th, & td': {
            border: '1px solid var(--gray-3)',
            padding: '6px 8px',
          },

          '& th': {
            backgroundColor: 'var(--gray-1)',
            fontWeight: 600,
          },
        },
      })}
    >
      {children}
    </Box>
  );
};
