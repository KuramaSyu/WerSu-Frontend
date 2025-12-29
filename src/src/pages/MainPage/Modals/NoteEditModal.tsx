import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  lighten,
  type Theme,
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
  codeMirrorExtensions$,
  codeMirrorPlugin,
  ConditionalContents,
  imagePlugin,
  InsertCodeBlock,
  InsertImage,
  InsertSandpack,
  InsertTable,
  linkDialogPlugin,
  linkPlugin,
  MDXEditor,
  sandpackConfig$,
  sandpackPlugin,
  searchPlugin,
  ShowSandpackInfo,
  tablePlugin,
  useCodeBlockEditorContext,
  type CodeBlockEditorDescriptor,
  type SandpackConfig,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { nord } from '@uiw/codemirror-theme-nord';

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
import {
  HighlightStyle,
  tags,
  type Tag,
  type TagStyle,
} from '@codemirror/highlight';
import { EditorView } from '@codemirror/view';
import TablePopoverStyles from './TablePopoverStyles';

const muiCodeMirrorTheme = (muiTheme: Theme) =>
  EditorView.theme(
    {
      '&': {
        backgroundColor: muiTheme.palette.background.paper,
        color: muiTheme.palette.text.primary,
        //fontFamily: muiTheme.typography.fontFamily,
      },
      '.cm-matchingBracket *,.cm-content .cm-matchingBracket': {
        backgroundColor: muiTheme.palette.muted.dark,
        color: muiTheme.palette.vibrant.light,
      },
      '.cm-content': {
        caretColor: muiTheme.palette.primary.main,
      },
      '.cm-scroller': {
        padding: 0,
        margin: 0,
      },
      // cursor
      '&.cm-focused .cm-cursor': {
        borderLeftColor: muiTheme.palette.text.secondary,
      },

      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: muiTheme.palette.muted.light,
      },
      /* find results */
      '.cm-selectionMatch': {
        backgroundColor: muiTheme.palette.action.hover,
        color: muiTheme.palette.text.primary,
      },

      /* Active line */
      '.cm-activeLineGutter': {
        backgroundColor: muiTheme.palette.action.hover,
      },

      // line numbers
      '.cm-gutters': {
        backgroundColor: muiTheme.palette.background.default,
        color: muiTheme.palette.text.secondary,
      },
    },
    { dark: muiTheme.palette.mode === 'dark' }
  );

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
  onSave: (title: string, content: string) => void;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  open,
  onClose,
  title,
  content,
  onSave,
}) => {
  const { theme } = useThemeStore();
  const editorRef = useRef<MDXEditorMethods>(null);

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        onSave(title, editorRef.current?.getMarkdown() || '');
      }}
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
        <IconButton
          onClick={() => {
            onSave(title, editorRef.current?.getMarkdown() || '');
            onClose();
          }}
          size="small"
        >
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
        {/* this is a very nasty workaround 
        to map the mdxeditor styles to mui theme colors */}
        <Box
          sx={{
            my: M3,
            /* remove padding and border arround the codeblock */
            '& [class^="_codeMirrorWrapper"]': {
              p: 0,
              border: 'none',
              borderRadius: 0,
              background: 'transparent',
            },

            // to deactivate the codeblock toolbar
            '& .mdxeditor [class*="codeMirrorToolbar"]': {
              //display: 'none',
            },

            '& .mdxeditor-toolbar': {
              backgroundColor: theme.palette.background.paper,
              '& [class*="selectTrigger"]': {
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.muted.light,
              },

              '& label': {
                color: theme.palette.text.primary,
              },

              /* Activated buttons */
              '& button[data-state="on"]': {
                backgroundColor: theme.palette.muted.light,
                color: theme.palette.primary.light,
              },

              /* button icons */
              '& span': {
                color: theme.palette.primary.light,
              },
              '& button span': {
                color: theme.palette.primary.light,
              },
              '& button span svg': {
                color: 'inherit',
              },

              /* Disabled buttons */
              '& button:disabled, & button:disabled span': {
                opacity: 0.5,
              },

              /* button hover effect */
              '& button:hover, & button:focus': {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.primary.main,
              },
            },

            /* Code block toolbar  */
            '& [class*="codeMirrorToolbar"]': {
              backgroundColor: theme.palette.muted.light,
              //border: `1px solid ${theme.palette.muted.light}`,
              borderRadius: theme.shape.borderRadius,
              padding: 0,
            },

            /* Buttons inside the code toolbar */
            '& [class*="codeMirrorToolbar"] button': {
              color: theme.palette.text.primary,
              backgroundColor: 'transparent',
              borderRadius: theme.shape.borderRadius,
            },

            '& [class*="codeMirrorToolbar"] button:hover': {
              backgroundColor: theme.palette.action.hover,
            },
            // content area, background and text colors
            '& .mdxeditor-root-contenteditable': {
              backgroundColor: theme.palette.background.default,
              color: theme.palette.text.primary,

              // normal text
              '& h1, & h2, & h3, & h4, & h5, & h6, & strong, & em, & li, & blockquote, & p':
                {
                  color: theme.palette.text.primary,
                },

              // links
              '& a': {
                color: theme.palette.primary.main,
              },

              // code blocks
              '& code, & code span, & code strong': {
                color: lighten(theme.palette.secondary.main, 1 / 4),
                backgroundColor: theme.palette.muted.light,
                borderRadius: M1,
                fontFamily: 'Monospace',
              },
            },

            /* Table container - any class starting with _tableEditor_ */
            // '[class^="_tableEditor_"]': {
            //   borderCollapse: 'collapse',
            //   width: '100%',
            //   backgroundColor: theme.palette.background.paper,
            //   color: theme.palette.text.primary,
            // },

            /* Table cells*/
            // '[class*="Cell_"]': {
            //   //border: `1px solid ${theme.palette.muted.light}`,
            //   padding: theme.spacing(1),
            //   // textAlign: 'left',
            //   // verticalAlign: 'middle',
            //   // color: theme.palette.text.primary,
            //   // backgroundColor: theme.palette.background.default,
            // },

            /* Table add row/col buttons */
            '[class^="_table"] button': {
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.muted.light,
              borderRadius: theme.shape.borderRadius,
              padding: theme.spacing(0.5),
              minWidth: 0,
            },
            '[class^="_table"] button svg': {
              color: theme.palette.secondary.light,
            },

            /* Hover state */
            // '[class^="_table"] button:hover': {
            //   backgroundColor: theme.palette.action.selected,
            // },

            /* Disabled buttons */
            // '[class^="_table"] button:disabled': {
            //   //color: theme.palette.text.disabled,
            //   //backgroundColor: 'transparent',
            // },

            /* SVG icons inside buttons */
            // '[class^="_table"] button svg path': {
            //   fill: theme.palette.text.primary,
            // },

            '[class*="_tableColumnEditorTrigger_"]': {
              backgroundColor: theme.palette.muted.light,
              color: theme.palette.primary.main,
            },
          }}
        >
          <TablePopoverStyles />
          <MDXEditor
            markdown={content.replace(/<([#\/\w]+)/g, '&lt;$1')}
            //onChange={onSave}
            ref={editorRef}
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
                    <InsertTable />
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
              codeBlockPlugin({
                defaultCodeBlockLanguage: '',
              }),
              codeMirrorPlugin({
                codeMirrorExtensions: [muiCodeMirrorTheme(theme)],
                codeBlockLanguages: {
                  js: 'JavaScript',
                  css: 'CSS',
                  py: 'Python',
                  ts: 'TypeScript',
                  rs: 'Rust',
                  go: 'Go',
                  sh: 'Shell',
                  bash: 'Bash',
                  java: 'Java',
                  ['']: 'Plain Text',
                },
              }),
              sandpackPlugin({ sandpackConfig: simpleSandpackConfig }),
              linkPlugin(),
              linkDialogPlugin(),
              imagePlugin({
                imageUploadHandler: () => {
                  return Promise.resolve('https://picsum.photos/200/300');
                },
                imageAutocompleteSuggestions: [
                  'https://picsum.photos/200/300',
                  'https://picsum.photos/200',
                ],
              }),
              tablePlugin(),
              searchPlugin(),
            ]}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};
