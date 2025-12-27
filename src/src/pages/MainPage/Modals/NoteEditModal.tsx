import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from '@mui/material';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CloseIcon from '@mui/icons-material/Close';
import { useEffect, useRef } from 'react';
import { useThemeStore } from '../../../zustand/useThemeStore';
import { M1, M2, M3, M4 } from '../../../statics';
import { MDXEditor } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  type MDXEditorMethods,
  type MDXEditorProps,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import {
  UndoRedo,
  BoldItalicUnderlineToggles,
  toolbarPlugin,
} from '@mdxeditor/editor';
import { MdxEditorMuiTheme } from './MxEditorMuiTheme';

interface NoteEditorModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  onSave: (content: string) => void;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  open,
  onClose,
  title,
  content,
  onSave,
}) => {
  const { theme } = useThemeStore();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      sx={{ color: theme.palette.text.primary }}
      fullWidth
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.palette.background.paper,
          padding: M2,
        }}
      >
        {title}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          backgroundColor: theme.palette.background.default,
          minHeight: '40vh',
          // display: 'flex',
        }}
      >
        <MdxEditorMuiTheme sx={{ py: M3 }}>
          <MDXEditor
            markdown={content}
            onChange={onSave}
            plugins={[
              toolbarPlugin({
                toolbarClassName: 'my-classname',
                toolbarContents: () => (
                  <>
                    <UndoRedo />
                    <BoldItalicUnderlineToggles />
                  </>
                ),
              }),

              // Example Plugin Usage
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
            ]}
            className={theme.palette.mode === 'dark' ? 'dark-theme' : ''}
            style={
              {
                /* Accent (primary) */
                '--accentSolid': theme.palette.primary.main,
                '--accentSolidHover': theme.palette.primary.light,
                '--accentText': theme.palette.primary.contrastText,

                /* Base (background / surfaces) */
                '--baseBg': theme.palette.background.paper,
                '--basePageBg': theme.palette.background.default,
                '--baseBorder': theme.palette.divider,
                '--baseText': theme.palette.text.primary,

                /* Typography */
                fontFamily: theme.typography.fontFamily,
                '--font-mono': theme.typography.fontFamilyMonospace,
              } as React.CSSProperties
            }
          />
        </MdxEditorMuiTheme>
      </DialogContent>
    </Dialog>
  );
};
