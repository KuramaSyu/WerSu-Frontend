import {
  createContext,
  use,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
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
import {
  useEditor,
  EditorContent,
  useEditorState,
  Editor,
  type JSONContent,
  markdown,
} from "@tiptap/react";
import DragHandle from "@tiptap/extension-drag-handle-react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor, {
  CollaborationCaret,
} from "@tiptap/extension-collaboration-caret";
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
import { AttachmentApi } from "../../api/AttachmentApi";
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
import { LatexDialog, type LatexDialogProps } from "./LatexDialog";
import { CustomTableCell } from "../../components/Editor/TableControlls/CustomTableCell";
import { CustomImage } from "../../components/Editor/View/CustomImage";
import {
  normalizeTableCell,
  normalizeTables,
} from "../../components/Editor/jsonNormalization";
import { useNoteCollaboration } from "../../hooks/useNoteCollaboration";
import { useUsersStore, useUserStore } from "../../zustand/userStore";
import {
  colorFromString,
  randomMatchingColor,
} from "../../utils/blendWithContrast";
import { useAccessToken } from "../../api/queries/useAccessToken";
import * as Y from "yjs"; // Ensure Yjs is imported directly if needed
import { Awareness } from "y-protocols/awareness";
import { useUser } from "../../api/queries/useUser";
import { useLiveUsersStore } from "../../zustand/useLiveUsersStore";
import {
  collabStatusStore,
  type CollabStatus,
} from "../../zustand/useCollabStatusStore";
import { queryClient } from "../../api/queryClient";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useUpdateNote } from "../../api/queries/useNoteQueries";
import { AttachmentLinkBuilder } from "../../api/utils/AttachmentLInkBuilder";

const lowlight = createLowlight(all);

export interface AppLayoutProps {
  children: ReactNode;
}

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
  const { data: user } = useUser();
  const setMessage = useInfoStore((s) => s.setMessage);
  const { mutateAsync: updateNote } = useUpdateNote();

  const {
    isSaving,
    title,
    setTitle,
    sourceMarkdown,
    setSourceMarkdown,
    setContent,
    save,
    setUpdateNoteFn,
    setEditor,
    registerNote,
  } = useActiveNoteStore();

  // Tracks which editor surface is active and if write/read is used
  const { viewMode: editorMode, editMode } = useEditorSettings();

  // ydoc for collaboration -> only load in edit mode
  const collaboration = useNoteCollaboration(editMode ? noteId : undefined);
  const emptyYdoc = useRef(new Y.Doc());
  const dummyProvider = useRef({
    awareness: new Awareness(new Y.Doc()),
    on: () => {},
    off: () => {},
    connect: () => {},
    disconnect: () => {},
  });
  const stableYdoc = collaboration?.ydoc ?? emptyYdoc.current;
  const stableProvider = collaboration?.provider ?? dummyProvider.current;

  // dialog open state for file upload
  const [fileUploadDialogOpen, setFileUploadDialogOpen] = useState(false);

  // ref for textfield of source view
  const sourceEditorRef = useRef<HTMLInputElement | null>(null);

  const EMPTY_DIALOG = {
    open: false,
    latexCode: "",
    onClose: () => {},
    onCancel: () => {},
  };

  // i am sorry, this got quite complex.
  // what it does: the open opens the LatexDialog. All other things
  // are the dialogs inputs. These inputs (latex, inline, compressed)
  // are inserted into the onClose and onCancel handlers which get called
  // when the user confirms or cancels the dialog.
  const [latexDialogProps, setLatexDialogProps] =
    useState<LatexDialogProps>(EMPTY_DIALOG);

  /**factory for props for a default closed dialog */
  const getLatexDialogProps = useCallback(() => {
    return {
      open: false,
      latexCode: "",

      onClose: (
        latex: string,
        inline: "inline" | "block",
        compressed: boolean,
      ) => {},
      onCancel: (
        latex: string,
        inline: "inline" | "block",
        compressed: boolean,
      ) => {
        setLatexDialogProps({
          ...latexDialogProps,
          open: false,
        });
      },
    };
  }, [setLatexDialogProps, latexDialogProps]);

  useEffect(() => {
    setTitle(note?.title ?? "");
  }, [note?.id, note?.title]);

  useEffect(() => {
    if (note) {
      setSourceMarkdown(note.content || note.stripped_content || "");
    }
  }, [note?.id]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          dropcursor: {},
          undoRedo: false,
        }),
        Collaboration.configure({
          document: stableYdoc,
        }),
        CollaborationCaret.configure({
          provider: stableProvider,
          user: {
            name: `${user?.username}`,
            id: user?.id,
            // random color
            color: randomMatchingColor(theme),
          },
        }),
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
        CustomImage,
        // CustomImage,
        //CustomTableCell,
        TableCell,

        TableRow,
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
                initialLatexType: "block",
                onClose: (newCalculation, inline, compressed) => {
                  const chain = editor.chain().setNodeSelection(pos);

                  if (inline === "block") {
                    chain.updateBlockMath({ latex: newCalculation });
                  } else {
                    chain.deleteBlockMath();
                    chain.insertInlineMath({ latex: newCalculation });
                  }
                  chain.focus().run();

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
                initialLatexType: "inline",
                onClose: (newCalculation, inline, compressed) => {
                  const chain = editor.chain().setNodeSelection(pos);

                  if (inline === "inline") {
                    chain.updateInlineMath({ latex: newCalculation });
                  } else {
                    chain.deleteInlineMath();
                    chain.insertBlockMath({ latex: newCalculation });
                  }
                  chain.focus().run();
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
      ],

      content: undefined, // our content needs processing and this needs the editor e.g. here not possible
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
          // const isDraggedDiv =
          //   event.dataTransfer?.files.length === 0 &&
          //   event.dataTransfer?.items.length !== 0;
          // if (isDraggedDiv) {
          //   // a img div was moved within the editor -> let tiptap handle it e.g. move the node
          //   console.log("div dragged within editor, let tiptap handle it");
          //   return false;
          // }

          // check for a dropped attachment-chip
          const jsonBody = event.dataTransfer?.getData(
            "application/x-application-attachment",
          );
          if (!jsonBody) {
            console.log("no attachment data, let tiptap handle drop");
            return false; // let tiptap handle drop, e.g. do nothing
          }
          const attachmentBody = JSON.parse(
            jsonBody,
          ) as ApplicationAttachmentBody;

          if (!attachmentBody.key) {
            console.error("Attachment data missing key:", attachmentBody);
            return false; // let tiptap handle drop, e.g. do nothing
          }

          const coords = {
            left: event.clientX,
            top: event.clientY,
          };
          const pos = view.posAtCoords(coords);
          if (!pos) {
            console.error(
              `Failed to process the drop of attachment ${attachmentBody.filename}: could not get drop position from coordinates ${JSON.stringify(coords)}`,
            );

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
    },
    [noteId, collaboration?.ydoc], // recreate editor when noteId changes to reconnect to a correct Yjs document
  );

  // register editor to useActiveNoteStore for global access and cleanup on unmount
  useEffect(() => {
    console.log("Rebuild Editor Zustand");
    registerNote(noteId, onNoteUpdated);
    setEditor(editor ?? null);
    setUpdateNoteFn((title: string, content: string) => {
      return updateNote({ noteId: noteId!, title, content });
    });

    // in view mode, initialize content
    if (!editMode && note) {
      setContent(note.content);
    }

    return () => useActiveNoteStore.getState().setEditor(null);
  }, [editor]);

  // read <--> write
  useEffect(() => {
    editor?.setEditable(editMode);
  }, [editMode, editor]);

  // update live users from provider to zustand store
  useEffect(() => {
    if (!collaboration?.provider?.awareness || !noteId) {
      return;
    }
    const { provider } = collaboration;
    const awareness = provider.awareness;

    const updateUsers = () => {
      if (!awareness || !noteId) return;
      var users = [];
      for (const state of awareness.getStates().values()) {
        if (state.user) {
          users.push({
            userId: state.user.id,
            color: state.user.color,
          });
        }
      }
      useLiveUsersStore.getState().setUsers(noteId, users);
      console.log("Updated live users from awareness states:", users);
    };

    awareness!.on("change", updateUsers);
    updateUsers();

    return () => {
      awareness!.off("change", updateUsers);
      useLiveUsersStore.getState().clearUsers(noteId);
    };
  }, [noteId, collaboration?.provider]);

  // Mirror the provider's connection state into a zustand store so the
  // toolbar badge can render without prop-drilling the provider instance.
  useEffect(() => {
    if (!noteId || !editMode) {
      if (noteId) collabStatusStore.getState().setStatus(noteId, "idle");
      return;
    }
    if (!collaboration?.provider) return; // hook is waiting on the JWT — leave its diagnostic alone

    const { provider } = collaboration;
    const setStatus = (status: CollabStatus, message?: string) =>
      collabStatusStore.getState().setStatus(noteId, status, message);

    const onStatus = (event: { status: string }) => {
      switch (event.status) {
        case "connecting":
          setStatus(
            "connecting",
            "Opening WebSocket to the collaboration server…",
          );
          break;
        case "connected":
          setStatus("connected");
          break;
        case "disconnected":
          setStatus(
            "disconnected",
            "WebSocket closed. The provider will retry automatically.",
          );
          break;
      }
    };
    const onAuthenticated = () => setStatus("connected");
    const onAuthenticationFailed = (event?: { reason?: string }) =>
      collabStatusStore
        .getState()
        .setAuthFailed(noteId, event?.reason ?? "unknown reason");

    provider.on("status", onStatus);
    provider.on("authenticated", onAuthenticated);
    provider.on("authenticationFailed", onAuthenticationFailed);

    // Seed the status from the current provider state — needed because we
    // may subscribe *after* the socket has already opened.
    const current = (provider as { status?: string }).status;
    if (current === "connected") setStatus("connected");
    else if (current === "connecting") setStatus("connecting");
    else setStatus("disconnected");

    return () => {
      provider.off("status", onStatus);
      provider.off("authenticated", onAuthenticated);
      provider.off("authenticationFailed", onAuthenticationFailed);
    };
  }, [noteId, editMode, collaboration?.provider]);

  // is write mode only: load last api version
  // useEffect(() => {
  //   if (!editor || !note || editMode || !editor.storage.markdown) {
  //     console.log(
  //       "not loading markdown into editor, missing editor or note or not in edit mode:",
  //       { editor, note, editMode, markdownStorage: editor?.storage.markdown },
  //     );
  //     return;
  //   }

  //   console.log("load markdown content into editor");
  //   const normalizedDoc = markdownToProsemirror(
  //     editor,
  //     note.content || note.stripped_content || "",
  //   );
  //   // microtask prevents flush issue in logs
  //   queueMicrotask(() => {
  //     editor.commands.setContent(normalizedDoc);
  //   });
  // }, [note, editMode, editor.storage.markdown]);

  // load ydoc and collaboration content into editor
  useEffect(() => {
    if (!editor || !collaboration?.ydoc || !collaboration?.provider) {
      return;
    }

    if (!editMode) {
      console.log("read mode - disconnect from collaboration provider");
      collaboration.provider.disconnect();
      return;
    }

    // from here on edit mode
    const { provider, ydoc } = collaboration;

    // call when hocuspocus returned the note state
    const onSynced = () => {
      const isEmpty = ydoc!.getXmlFragment("default").length === 0;

      // if ydoc is not empty, then use this ydoc instead
      if (!isEmpty) return;

      console.log(
        "No draft on websocket, loading draft from markdown (note content)",
      );

      setContent(note!.content);
    };

    provider.on("synced", onSynced);
    // provider.on("synced", () => {
    //   console.log("YJS Sync:", JSON.stringify(editor.getJSON(), null, 2));
    // });

    return () => {
      provider.off("synced", onSynced);
    };
  }, [editor, note?.id, collaboration?.provider]);

  /** returns the current content as markdown */
  // const getCurrentContent = () => {
  //   if (editorMode === "source") {
  //     return sourceMarkdown;
  //   } else {
  //     return editor?.getMarkdown() ?? "";
  //   }
  // };

  /** Sets the content of the editor either into the source or rich editor without saving */
  // const setContent = (content: string) => {
  //   if (editorMode === "source") {
  //     setSourceMarkdown(content);
  //   } else {
  //     const normalizedDoc = markdownToProsemirror(editor, content);
  //     // microtask prevents flush issue in logs
  //     queueMicrotask(() => {
  //       editor.commands.setContent(normalizedDoc);
  //     });
  //   }
  // };

  // Saves either the rich editor markdown or the source editor content.
  // const handleSave = async (
  //   newTitle: string | undefined = undefined,
  //   newContent: string | undefined = undefined,
  // ) => {
  //   if (editorMode === "rich" && !editor) {
  //     return;
  //   }

  //   // if new content was provided, the content needs to be
  //   // put into the editor. In case of markdown content, this
  //   // happens automatically. otherwise trigger it with this bool
  //   const updateView = newContent !== undefined;

  //   const title = newTitle ?? noteTitle;
  //   if (newTitle !== undefined) {
  //     setNoteTitle(newTitle);
  //   }

  //   const markdown = newContent ?? getCurrentContent();

  //   // put markdown into editor if source edit was used
  //   // or content was otherwise changed outside of the editor
  //   if (editorMode === "source") {
  //     setContent(markdown);
  //     console.log(
  //       "JSON after markdown save:",
  //       JSON.stringify(editor.getJSON(), null, 2),
  //     );
  //   }

  //   if (updateView) {
  //     setContent(markdown);
  //   }

  //   setIsSaving(true);
  //   try {
  //     const saved = await new NoteApi().patch(noteId!, title, markdown);
  //     console.log("invalidate queries and retech after save");
  //     queryClient.invalidateQueries({ queryKey: ["activity"] });
  //     queryClient.refetchQueries({ queryKey: ["activity", "note", noteId!] });
  //     if (!saved) {
  //       setMessage(new SnackbarUpdateImpl("Failed to save note", "error"));
  //       return;
  //     }
  //     onNoteUpdated(saved);
  //     setNoteTitle(saved.title);
  //     setMessage(new SnackbarUpdateImpl("Note saved", "success"));
  //   } catch (error) {
  //     console.error("Save failed", error);
  //     setMessage(new SnackbarUpdateImpl("Failed to save note", "error"));
  //   } finally {
  //     setIsSaving(false);
  //   }
  // };

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
        color="backgroundDefault"
        sx={{
          height: "auto",
          flex: 1,
          px: M3,
          borderRadius: M2,
          display: "flex",
          flexDirection: "column",
          gap: M3,
          // background: theme.palette.background.default,
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
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            alignContent: "flex-start",
            width: "100%",
          }}
          spacing={M3}
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Note title"
            disableUnderline
            sx={{
              width: `clamp(200px,${Math.max(title.length, 4)}ch, 80%)`,
              fontSize: theme.typography.h2,
              pr: M2,
            }}
          />
          <NoteButtonActionRow />
        </Stack>

        {/* Rich Editor */}
        {editor && editorMode === "rich" && (
          <>
            <TextSelectionBubbleMenu editor={editor} enabled={editMode} />
            <SlashCommandMenu editor={editor} enabled={editMode} />

            <Box className="editor-drag-region">
              {/* hide handlers when editor is not editable */}
              <DragHandle
                editor={editor}
                className={`note-block-drag-handle ${editMode ? "" : "note-block-drag-handle--hidden"} `}
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
          <Typography color="textSecondary">Loading editor...</Typography>
        )}
      </Paper>

      {/* Floating editor actions */}
      <InsertSpeedDial
        editor={editor}
        handleSave={save}
        setSourceMarkdown={setSourceMarkdown}
        setFileUploadDialogOpen={setFileUploadDialogOpen}
        setVersionsOpen={() => {}}
        sourceMarkdown={sourceMarkdown}
      />

      {/* dialog which opens on file upload click */}
      <UploadFileDialog
        noteId={noteId!}
        directoryId={note?.get_dir()!}
        insertAtCurrentPosition={insertAtCurrentPosition}
        dialogOpen={fileUploadDialogOpen}
        setDialogOpen={setFileUploadDialogOpen}
        onUploadSuccess={(_) => save()}
        editor={editor}
      />
      <LatexDialog
        open={latexDialogProps.open}
        latexCode={latexDialogProps.latexCode}
        onClose={latexDialogProps.onClose}
        onCancel={latexDialogProps.onCancel}
        setOpen={(open) => setLatexDialogProps({ ...latexDialogProps, open })}
        initialLatexType={latexDialogProps.initialLatexType}
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

export function markdownToProsemirror(
  editor: Editor,
  markdown: string,
): JSONContent {
  // first parse markdown normally with builtin markdown extension
  const pmDoc = editor.storage.markdown.manager.parse(markdown);
  // now: a table cell containing an image with text gets rendered to
  // <p>text <img/></p>. The problem with it is, that when now the user
  // starts editing the text, the image just gets deleted and ctrl z is also
  // not possible. Hence we normalize the JSON structure, to render it as <p>text</p><img/>
  // keep in mind, that it parses a JSON, not HTML. I just used HTML for describing
  const normalizedDoc = normalizeTables(pmDoc);
  return normalizedDoc;
}
