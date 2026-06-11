import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  Alert,
  Box,
  Button,
  Input,
  Paper,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import CodeIcon from "@mui/icons-material/Code";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import SaveIcon from "@mui/icons-material/Save";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import DragHandle from "@tiptap/extension-drag-handle-react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { all, createLowlight } from "lowlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Youtube } from "@tiptap/extension-youtube";
import { Twitch } from "@tiptap/extension-twitch";
import { TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Highlight } from "@tiptap/extension-highlight";
import Mathematics, { migrateMathStrings } from "@tiptap/extension-mathematics";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import "katex/dist/katex.min.css";
import "../../styles/tiptap.css";
import { TableWithControls } from "../../components/Editor/TableControlls/TableControlls";
import { ThemedEditorBox } from "../../components/Editor/ThemedEditorBox";
import { TextSelectionBubbleMenu } from "../../components/Editor/TextSelectionBubbleMenu";
import { SlashCommandMenu } from "../../components/Editor/SlashCommandMenu";
import { M2, M3, M4 } from "../../statics";
import { NoteApi } from "../../api/NoteApi";
import type { Note } from "../../api/models/search";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { NoteVersionsDrawer } from "../../components/NoteVersionsDrawer";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import FileHandler from "@tiptap/extension-file-handler";
import Image from "@tiptap/extension-image";
import Document from "@tiptap/extension-document";
import { Dropcursor } from "@tiptap/extensions";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import UploadFileDialog from "./UploadSpeedDialAction";
import { AttachmentApi, AttachmentLinkBuilder } from "../../api/AttachmentApi";
import UploadFileBuilder from "./UploadFileBuilder";
import {
  getNodeByFileType,
  getPasteUploadExtension,
  UploadAttachmentNode,
} from "../../components/Editor/ImagePasteExtension";
import type { ApplicationAttachmentBody } from "./AttachmentPanelSection";
import { useThemeStore } from "../../zustand/useThemeStore";
import { NoteButtonActionRow } from "./NoteButtonActionRow";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { InsertSpeedDial } from "./SpeedDial";
import { LatexDialog } from "./LatexDialog";

const lowlight = createLowlight(all);
const DRAG_HANDLE_GUTTER_PX = 28;

interface NoteEditorProps {
  note?: Note;
  noteId?: string;
  fetchError: string | null;
  onNoteUpdated: (note: Note) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  noteId,
  fetchError,
  onNoteUpdated,
}) => {
  const { theme } = useThemeStore();
  const { setMessage } = useInfoStore();
  const [noteTitle, setNoteTitle] = useState(note?.title ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isInDragHandleArea, setIsInDragHandleArea] = useState(false);
  // Tracks which editor surface is active.
  const {
    viewMode: editorMode,
    setViewMode: setEditorMode,
    editMode,
  } = useEditorSettings();
  // Holds the markdown for source-mode editing.
  const [sourceMarkdown, setSourceMarkdown] = useState("");
  // Controls the version history drawer.
  const [versionsOpen, setVersionsOpen] = useState(false);
  // Currently selected version metadata + content snapshot.
  const [selectedVersion, setSelectedVersion] =
    useState<NoteVersionSummaryReply | null>(null);
  const [selectedVersionContent, setSelectedVersionContent] = useState<
    string | null
  >(null);
  // Loading state for fetching a specific version.
  const [isFetchingVersion, setIsFetchingVersion] = useState(false);
  // Loading state for restore flow.
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);

  // dialog open state for file upload
  const [fileUploadDialogOpen, setFileUploadDialogOpen] = useState(false);

  // used to set write/read mode
  const { editMode: isWriteMode } = useEditorSettings();

  // ref for textfield of source view
  const sourceEditorRef = useRef<HTMLInputElement | null>(null);

  const [latexDialogProps, setLatexDialogProps] = useState<{
    open: boolean;
    latexCode?: string;
    onClose: (latex: string) => void;
    onCancel?: (latex: string) => void;
  }>({
    open: false,
    latexCode: "",
    onClose: (latex: string) => {},
    onCancel: (latex: string) => {},
  });

  const getLatexDialogProps = useCallback(() => {
    return {
      open: false,
      latexCode: "",
      onClose: (latex: string) => {},
      onCancel: (latex: string) => {
        setLatexDialogProps({
          ...latexDialogProps,
          open: false,
        });
      },
    };
  }, [setLatexDialogProps, latexDialogProps]);

  useEffect(() => {
    setNoteTitle(note?.title ?? "");
  }, [note?.id, note?.title]);

  useEffect(() => {
    if (note) {
      setSourceMarkdown(note.content || note.stripped_content || "");
    }
  }, [note?.id]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, dropcursor: {} }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Youtube.configure({ inline: false, width: 480, height: 320 }),
      Twitch.configure({
        inline: false,
        width: 480,
        height: 320,
        parent: window.location.hostname,
      }),
      UploadAttachmentNode,
      Image,
      Dropcursor,
      Document,
      TableRow,
      TableCell,
      TableHeader,
      TableWithControls.configure({ resizable: false }),
      Highlight,
      Mathematics.configure({
        blockOptions: {
          onClick: (node, pos) => {
            if (!editor.isEditable) {
              return;
            }
            // open latex dialog with current latex code
            // and insert it if the user confirms the dialog
            setLatexDialogProps({
              ...getLatexDialogProps(),
              open: true,
              latexCode: node.attrs.latex,
              onClose: (newCalculation) => {
                editor
                  .chain()
                  .setNodeSelection(pos)
                  .updateBlockMath({ latex: newCalculation })
                  .focus()
                  .run();
                setLatexDialogProps(getLatexDialogProps());
              },
            });
          },
        },
        inlineOptions: {
          onClick: (node, pos) => {
            if (!editor.isEditable) {
              return;
            }

            // open latex dialog with current latex code
            // and insert it if the user confirms the dialog
            setLatexDialogProps({
              ...getLatexDialogProps(),
              open: true,
              latexCode: node.attrs.latex,
              onClose: (newCalculation) => {
                editor
                  .chain()
                  .setNodeSelection(pos)
                  .updateInlineMath({ latex: newCalculation }) // <-- the only difference to the previous handler
                  .focus()
                  .run();
                setLatexDialogProps(getLatexDialogProps());
              },
            });
          },
        },
      }),

      getPasteUploadExtension(handlePasteAndUpload, (message, severity) => {
        setMessage(new SnackbarUpdateImpl(message, severity));
      }),
      Placeholder.configure({
        // Show hint only for the currently focused empty paragraph.
        showOnlyCurrent: true,
        includeChildren: false,
        placeholder: ({ node, editor: placeholderEditor }) => {
          // Restrict placeholder to standard paragraph lines.
          if (node.type.name !== "paragraph") {
            return "";
          }

          if (
            // Avoid showing this hint in structured block contexts.
            placeholderEditor.isActive("table") ||
            placeholderEditor.isActive("bulletList") ||
            placeholderEditor.isActive("orderedList") ||
            placeholderEditor.isActive("taskList") ||
            placeholderEditor.isActive("codeBlock")
          ) {
            return "";
          }

          // Main inline guidance for slash command discoverability.
          return "Write anything or use / for commands";
        },
      }),
      Markdown,

      // upload extension mechanics
      FileHandler.configure({
        allowedMimeTypes: [
          "image/png",
          "image/jpeg",
          "image/gif",
          "image/webp",
        ],
        onDrop: (currentEditor, files, pos) => {
          files.forEach((file) => {
            const fileReader = new FileReader();

            fileReader.readAsDataURL(file);

            fileReader.onload = () => {
              currentEditor
                .chain()
                .insertContentAt(pos, {
                  type: file.type,
                  attrs: {
                    src: fileReader.result,
                  },
                })
                .focus()
                .run();
            };
          });
        },
      }),
    ],

    content: "",
    contentType: "markdown",
    editorProps: {
      handleKeyDown(view, event) {
        // do not tab out of code block, but insert spaces within the code block
        if (event.key === "Tab" && editor?.isActive("codeBlock")) {
          event.preventDefault();
          const tab = "    ";
          const { state, dispatch } = view;
          const { selection } = state;
          dispatch(state.tr.insertText(tab, selection.from, selection.to));
          return true;
        }

        return false;
      },
      handleDrop(view, event) {
        // handle attachment drop -> insert image link
        // const node = getNodeByFileType(file, file.type, currentEditor.view);
        //     console.log(
        //       `insert node ${node} at pos ${pos} because of file drop`,
        //     );
        const jsonBody = event.dataTransfer?.getData(
          "application/x-application-attachment",
        );
        if (!jsonBody) {
          return false; // let tiptap handle drop, e.g. do nothing
        }
        const attachmentBody = JSON.parse(
          jsonBody,
        ) as ApplicationAttachmentBody;

        if (!attachmentBody.key) {
          return false; // let tiptap handle drop, e.g. do nothing
        }

        const coords = {
          left: event.clientX,
          top: event.clientY,
        };
        const pos = view.posAtCoords(coords);
        if (!pos) {
          return true;
        } // cancel

        const api = new AttachmentApi();
        const link = new AttachmentLinkBuilder(api)
          .setWidth(720)
          .setContentType(
            attachmentBody.contentType ?? "application/octet-stream",
          )
          .getLink(attachmentBody.key);
        const node = getNodeByFileType(
          attachmentBody.contentType,
          attachmentBody.filename,
          link,
          view,
        )!;
        const transaction = view.state.tr.insert(pos.pos, node);
        view.dispatch(transaction);
        return true; // handled
      },
    },
  });

  // read <--> write
  useEffect(() => {
    editor?.setEditable(isWriteMode);
  }, [isWriteMode, editor]);

  const isEditable = useEditorState({
    editor,
    selector: (context) => context.editor.isEditable,
  });

  useEffect(() => {
    if (!editor || !note) {
      return;
    }

    const markdownContent = note.content || note.stripped_content || "";
    editor.commands.setContent(markdownContent, { contentType: "markdown" });
  }, [editor, note?.id]);

  // Saves either the rich editor markdown or the source editor content.
  const handleSave = async () => {
    if (!noteId || (editorMode === "rich" && !editor)) {
      return;
    }

    const markdown =
      editorMode === "source" ? sourceMarkdown : (editor?.getMarkdown() ?? "");
    if (editorMode === "source" && editor) {
      editor.commands.setContent(markdown, { contentType: "markdown" });
    }

    setIsSaving(true);
    try {
      const saved = await new NoteApi().patch(noteId, noteTitle, markdown);
      if (!saved) {
        setMessage(new SnackbarUpdateImpl("Failed to save note", "error"));
        return;
      }
      onNoteUpdated(saved);
      setNoteTitle(saved.title);
      setMessage(new SnackbarUpdateImpl("Note saved", "success"));
    } catch (error) {
      console.error("Save failed", error);
      setMessage(new SnackbarUpdateImpl("Failed to save note", "error"));
    } finally {
      setIsSaving(false);
    }
  };

  // Loads the content for a selected version into the preview panel.
  const handleSelectVersion = async (version: NoteVersionSummaryReply) => {
    if (!noteId) {
      return;
    }
    setSelectedVersion(version);
    setIsFetchingVersion(true);
    try {
      const versionNote = await new NoteApi().getVersion(
        noteId,
        version.version_index,
      );
      if (!versionNote) {
        setMessage(new SnackbarUpdateImpl("Version not available", "error"));
        return;
      }
      setSelectedVersionContent(
        versionNote.content || versionNote.stripped_content || "",
      );
    } catch (error) {
      console.error("Failed to load version", error);
      setMessage(new SnackbarUpdateImpl("Failed to load version", "error"));
    } finally {
      setIsFetchingVersion(false);
    }
  };

  // Uploads file from clipboard and inserts into editor
  async function handlePasteAndUpload(file: File): Promise<string> {
    const api = new AttachmentApi();
    const builder = new UploadFileBuilder(api, postMessage)
      .setFile(file)
      .linkToNote(noteId!);
    const key = await builder.upload();
    const link = new AttachmentLinkBuilder(api).setWidth(720).getLink(key!);
    return link;
  }

  // Restores a version by saving its content as the latest note state.
  const handleRestoreVersion = async (version: NoteVersionSummaryReply) => {
    if (!noteId) {
      return;
    }
    setIsRestoringVersion(true);
    try {
      let content = selectedVersionContent;
      let restoredTitle = noteTitle;
      if (selectedVersion?.version_id !== version.version_id || !content) {
        const versionNote = await new NoteApi().getVersion(
          noteId,
          version.version_index,
        );
        if (!versionNote) {
          setMessage(new SnackbarUpdateImpl("Version not available", "error"));
          return;
        }
        content = versionNote.content || versionNote.stripped_content || "";
        restoredTitle = versionNote.title || restoredTitle;
        setSelectedVersionContent(content);
      }

      if (editor) {
        editor.commands.setContent(content ?? "", { contentType: "markdown" });
      }
      setSourceMarkdown(content ?? "");

      const saved = await new NoteApi().patch(
        noteId,
        restoredTitle,
        content ?? "",
      );
      if (!saved) {
        setMessage(
          new SnackbarUpdateImpl("Failed to restore version", "error"),
        );
        return;
      }
      onNoteUpdated(saved);
      setNoteTitle(saved.title);
      setMessage(new SnackbarUpdateImpl("Version restored", "success"));
    } catch (error) {
      console.error("Restore failed", error);
      setMessage(new SnackbarUpdateImpl("Failed to restore version", "error"));
    } finally {
      setIsRestoringVersion(false);
    }
  };

  const handleDragRegionMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const xInRegion = event.clientX - rect.left;
    setIsInDragHandleArea(xInRegion >= 0 && xInRegion <= DRAG_HANDLE_GUTTER_PX);
  };

  const handleDragRegionMouseLeave = () => {
    setIsInDragHandleArea(false);
  };

  /**
   * inserts a string at the current cursor position of the editor,
   * where it doesn't matter if the source or rich editor is used
   * @param imageLink the string to insert, usually used to insert image links
   */
  const insertAtCurrentPosition = (imageLink: string) => {
    const text = imageLinkToBlock(imageLink, editorMode);
    switch (editorMode) {
      case "rich":
        editor.chain().focus().insertContent(text).run();
        break;
      case "source": {
        const textarea = sourceEditorRef.current;
        if (!textarea) {
          return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        // reconstruct text to: text before selection + new text + text after selection
        const newValue =
          sourceMarkdown.substring(0, start ?? undefined) +
          text +
          (end ? sourceMarkdown.substring(end) : "");
        setSourceMarkdown(newValue);
      }
    }
  };

  return (
    <>
      <Paper
        elevation={1}
        sx={{
          height: "auto",
          flex: 1,
          p: M3,
          borderRadius: M2,
          display: "flex",
          flexDirection: "column",
          gap: M3,
          backgroundColor: "background.default",
        }}
        onClick={(event) => {
          // only focus editor, if the paper itself was clicked. not a child within it
          if (event.target !== event.currentTarget) {
            return;
          }
          editor.commands.focus("end");
        }}
      >
        {/* Main content heading  with title and save button*/}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          gap={M3}
          width={"100%"}
        >
          <Input
            value={noteTitle}
            onChange={(event) => setNoteTitle(event.target.value)}
            placeholder="Note title"
            disableUnderline
            sx={{
              width: `${Math.max(noteTitle.length, 4)}ch`,
              maxWidth: "60rem",
              fontSize: theme.typography.h2,
              pr: M2,
            }}
          />
          <NoteButtonActionRow
            editor={editor}
            editorMode={editorMode}
            isSaving={isSaving}
            handleSave={handleSave}
          />
        </Stack>

        {/* Rich Editor */}
        {editor && editorMode === "rich" && (
          <>
            <TextSelectionBubbleMenu editor={editor} enabled={isEditable} />
            <SlashCommandMenu editor={editor} enabled={isEditable} />
            <Box
              className="editor-drag-region"
              onMouseMove={handleDragRegionMouseMove}
              onMouseLeave={handleDragRegionMouseLeave}
            >
              {/* block drag drop handlers, which are hidden when not hovered and not active */}
              <DragHandle
                editor={editor}
                // ${isInDragHandleArea ? "note-block-drag-handle--active" : ""} ${isEditorFocused && !isInDragHandleArea ? "note-block-drag-handle--suppressed" : ""}
                className={`note-block-drag-handle ${isEditable ? "" : "note-block-drag-handle--hidden"} `}
                nested={false}
              >
                <DragIndicatorIcon fontSize="small" />
              </DragHandle>
              <ThemedEditorBox editor={editor}>
                <EditorContent editor={editor} className="tiptap" />
              </ThemedEditorBox>
            </Box>
          </>
        )}

        {/* Source Editor */}
        {editorMode === "source" && (
          <TextField
            value={sourceMarkdown}
            ref={sourceEditorRef}
            onChange={(event) => setSourceMarkdown(event.target.value)}
            multiline
            minRows={16}
            placeholder="Markdown source"
            fullWidth
            sx={{
              fontFamily: "monospace",
              "& .MuiInputBase-input": { fontFamily: "monospace" },
            }}
          />
        )}

        {!editor && (
          <Typography color="text.secondary">Loading editor...</Typography>
        )}
      </Paper>

      {/* Floating editor actions */}
      <InsertSpeedDial
        editor={editor}
        handleSave={handleSave}
        setSourceMarkdown={setSourceMarkdown}
        setFileUploadDialogOpen={setFileUploadDialogOpen}
        setVersionsOpen={setVersionsOpen}
        sourceMarkdown={sourceMarkdown}
      />

      {/* Right-side version history drawer */}
      <NoteVersionsDrawer
        open={versionsOpen}
        noteId={noteId}
        onClose={() => setVersionsOpen(false)}
        onSelectVersion={handleSelectVersion}
        onRestoreVersion={handleRestoreVersion}
        selectedVersion={selectedVersion}
        selectedContent={selectedVersionContent}
        currentContent={
          editorMode === "source"
            ? sourceMarkdown
            : (editor?.getMarkdown() ?? "")
        }
        isFetchingVersion={isFetchingVersion}
        isRestoring={isRestoringVersion}
      />

      {/* dialog which opens on file upload click */}
      <UploadFileDialog
        noteId={noteId!}
        directoryId={note?.get_dir()!}
        insertAtCurrentPosition={insertAtCurrentPosition}
        dialogOpen={fileUploadDialogOpen}
        setDialogOpen={setFileUploadDialogOpen}
        onUploadSuccess={(_) => handleSave()}
        editor={editor}
      />
      <LatexDialog
        open={latexDialogProps.open}
        latexCode={latexDialogProps.latexCode}
        onClose={latexDialogProps.onClose}
        onCancel={latexDialogProps.onCancel}
      />
    </>
  );
};

/**
 * when inserting an image, we need to check if we use tiptap editor or source mode. The tiptap editor
 * gets an HTML img block, where as the source editor gets the markdown image link.
 * @param imageLink link to build block of
 * @param editorMode editor mode
 * @returns the block for the current editor mode
 */
function imageLinkToBlock(imageLink: string, editorMode: "rich" | "source") {
  if (editorMode === "rich") {
    return `<img src="${imageLink}" />`;
  } else {
    return `![image](${imageLink})`;
  }
}
