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
import {
  ChangeCodeMirrorLanguage,
  codeBlockPlugin,
  codeMirrorPlugin,
  ConditionalContents,
  imagePlugin,
  InsertCodeBlock,
  InsertImage,
  InsertSandpack,
  linkDialogPlugin,
  linkPlugin,
  MDXEditor,
  sandpackConfig$,
  sandpackPlugin,
  searchPlugin,
  ShowSandpackInfo,
  tablePlugin,
  type SandpackConfig,
} from '@mdxeditor/editor';
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

const defaultSnippetContent = `
export default function App() {
return (
<div className="App">
<h1>Hello CodeSandbox</h1>
<h2>Start editing to see some magic happen!</h2>
</div>
);
}
`.trim();

const simpleSandpackConfig: SandpackConfig = {
  defaultPreset: 'react',
  presets: [
    {
      label: 'React',
      name: 'react',
      meta: 'live react',
      sandpackTemplate: 'react',
      sandpackTheme: 'light',
      snippetFileName: '/App.js',
      snippetLanguage: 'jsx',
      initialSnippetContent: defaultSnippetContent,
    },
  ],
};
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
          padding: M3,
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
        <Box
          sx={{
            my: M3,
            /* Update Toolbar of MDXEditor */
            '& .mdxeditor-toolbar': {
              backgroundColor: theme.palette.background.paper,
            },
            '& .mdxeditor-toolbar button': {
              color: theme.palette.primary.light,
            },
          }}
        >
          <MDXEditor
            markdown={content}
            onChange={onSave}
            plugins={[
              imagePlugin({
                imageUploadHandler: () => {
                  return Promise.resolve('https://picsum.photos/200/300');
                },
                imageAutocompleteSuggestions: [
                  'https://picsum.photos/200/300',
                  'https://picsum.photos/200',
                ],
              }),
              toolbarPlugin({
                toolbarContents: () => (
                  <>
                    <UndoRedo />
                    <BoldItalicUnderlineToggles />
                    <InsertImage />
                    <ConditionalContents
                      options={[
                        {
                          when: (editor) => editor?.editorType === 'codeblock',
                          contents: () => <ChangeCodeMirrorLanguage />,
                        },
                        {
                          when: (editor) => editor?.editorType === 'sandpack',
                          contents: () => <ShowSandpackInfo />,
                        },
                        {
                          fallback: () => (
                            <>
                              <InsertCodeBlock />
                              <InsertSandpack />
                            </>
                          ),
                        },
                      ]}
                    />
                  </>
                ),
              }),

              // Example Plugin Usage
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              codeBlockPlugin({ defaultCodeBlockLanguage: 'py' }),
              codeMirrorPlugin({
                codeBlockLanguages: { js: 'JavaScript', css: 'CSS' },
              }),
              sandpackPlugin({ sandpackConfig: simpleSandpackConfig }),
              linkPlugin(),
              linkDialogPlugin(),
              imagePlugin(),
              tablePlugin(),
              searchPlugin(),
            ]}
            className={theme.palette.mode === 'dark' ? 'dark-theme' : ''}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};
