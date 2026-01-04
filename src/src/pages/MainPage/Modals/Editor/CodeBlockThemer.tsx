import { lighten, styled } from '@mui/material/styles';
import { Box } from '@mui/material';

export const CodeBlockThemer = styled(Box)(({ theme }) => ({
  // Wrapper styles
  '&.tiptap': {
    '& :first-child': {
      marginTop: 0,
    },

    pre: {
      background: theme.palette.background.paper,
      borderRadius: '0.5rem',
      color: theme.palette.text.primary,
      fontFamily: `'JetBrainsMono', monospace`,
      margin: '1.5rem 0',
      padding: '0.75rem 1rem',
      overflowX: 'auto',

      code: {
        background: 'none',
        color: 'inherit',
        fontSize: '0.8rem',
        padding: 0,
      },

      // Code block syntax highlighting using hljs classes
      '.hljs-comment, .hljs-quote': {
        color: lighten(theme.palette.muted.dark, 0.5),
      },

      // variables

      '.hljs-variable, .hljs-template-variable, .hljs-attribute, .hljs-tag, .hljs-regexp, .hljs-link, .hljs-name, .hljs-selector-id, .hljs-selector-class':
        {
          color: theme.palette.secondary.main,
        },

      '.hljs-number, .hljs-meta, .hljs-built_in, .hljs-builtin-name, .hljs-literal, .hljs-type, .hljs-params':
        {
          color: theme.palette.warning.main,
        },

      '.hljs-string, .hljs-symbol, .hljs-bullet': {
        color: theme.palette.success.main,
      },

      '.hljs-title, .hljs-section': {
        color: theme.palette.info.light,
      },

      '.hljs-keyword, .hljs-selector-tag': {
        color: theme.palette.primary.main,
      },

      '.hljs-emphasis': {
        fontStyle: 'italic',
      },

      '.hljs-strong': {
        fontWeight: 700,
      },
    },
  },
}));
