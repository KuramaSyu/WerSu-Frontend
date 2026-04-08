import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import DragHandle from "@tiptap/extension-drag-handle-react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { all, createLowlight } from "lowlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Youtube } from "@tiptap/extension-youtube";
import { Twitch } from "@tiptap/extension-twitch";
import { Image } from "@tiptap/extension-image";
import { TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Highlight } from "@tiptap/extension-highlight";
import { Mathematics } from "@tiptap/extension-mathematics";
import { Markdown } from "@tiptap/markdown";
import "katex/dist/katex.min.css";
import "../../styles/tiptap.css";

import TopBar from "../../components/TopBar";
import { LeftSideView } from "../MainPage/LeftSideView";
import { TableWithControls } from "../MainPage/Modals/Editor/TableControlls";
import { ThemedEditorBox } from "../MainPage/Modals/Editor/ThemedEditorBox";
import { TextSelectionBubbleMenu } from "../MainPage/Modals/Editor/TextSelectionBubbleMenu";
import { LoginPage } from "../LoginPage/Main";
import { LoadingPage } from "../LoadingPage/Main";
import { M1, M2, M3, M4, M5 } from "../../statics";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useLoadingStore } from "../../zustand/loadingStore";
import { useUserStore } from "../../zustand/userStore";
import { NoteApi } from "../../api/NoteApi";
import { useNotesStore } from "../../zustand/useNotesStore";
import type { Note } from "../../api/models/search";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import type { ListDirectoriesQuery } from "../../api/DirectoryApi";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useThemeStore } from "../../zustand/useThemeStore";

const lowlight = createLowlight(all);
const DRAG_HANDLE_GUTTER_PX = 28;

export const NotePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { isLoading } = useLoadingStore();
  const { isMobile } = useBreakpoint();
  const { setMessage } = useInfoStore();
  const cachedNote = useNotesStore((state) =>
    id ? state.notes[id] : undefined,
  );
  const { setDirectories } = useDirectoryStore();

  const [leftPaneOpen, setLeftPaneOpen] = useState(true);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [note, setNote] = useState<Note | undefined>(cachedNote);
  const [noteTitle, setNoteTitle] = useState(cachedNote?.title ?? "");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInDragHandleArea, setIsInDragHandleArea] = useState(false);

  const directoryListQuery = useMemo<ListDirectoriesQuery>(
    () => ({ limit: 500, offset: 0 }),
    [],
  );
  const { data: directories } = useDirectoriesQuery(directoryListQuery, true);

  useEffect(() => {
    if (directories) {
      setDirectories(directories);
    }
  }, [directories, setDirectories]);

  useEffect(() => {
    if (!id) {
      setFetchError("Missing note id in route.");
      setNote(undefined);
      return;
    }

    if (cachedNote) {
      setNote(cachedNote);
      setNoteTitle(cachedNote.title);
      setFetchError(null);
      return;
    }

    let isMounted = true;
    const api = new NoteApi();
    api
      .get(id)
      .then((loadedNote) => {
        if (!isMounted) {
          return;
        }
        if (!loadedNote) {
          setFetchError("Note not found.");
          setNote(undefined);
          return;
        }
        setFetchError(null);
        setNote(loadedNote);
        setNoteTitle(loadedNote.title);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        console.error("Failed to load note", error);
        setFetchError("Failed to load note.");
      });

    return () => {
      isMounted = false;
    };
  }, [id, cachedNote]);

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
      Image,
      TableRow,
      TableCell,
      TableHeader,
      TableWithControls.configure({ resizable: false }),
      Highlight,
      Mathematics,
      Markdown,
    ],
    content: "",
    contentType: "markdown",
    editorProps: {
      handleKeyDown(view, event) {
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
    },
  });

  const isEditable = useEditorState({
    editor,
    selector: (context) => context.editor.isEditable,
  });

  const isEditorFocused = useEditorState({
    editor,
    selector: (context) => context.editor.isFocused,
  });

  useEffect(() => {
    if (!editor || !note) {
      return;
    }

    const markdownContent = note.content || note.stripped_content || "";
    editor.commands.setContent(markdownContent, { contentType: "markdown" });
  }, [editor, note?.id]);

  const handleSave = async () => {
    if (!id || !editor) {
      return;
    }

    setIsSaving(true);
    try {
      const markdown = editor.getMarkdown();
      const saved = await new NoteApi().patch(id, noteTitle, markdown);
      if (!saved) {
        setMessage(new SnackbarUpdateImpl("Failed to save note", "error"));
        return;
      }
      setNote(saved);
      setNoteTitle(saved.title);
      setMessage(new SnackbarUpdateImpl("Note saved", "success"));
    } catch (error) {
      console.error("Save failed", error);
      setMessage(new SnackbarUpdateImpl("Failed to save note", "error"));
    } finally {
      setIsSaving(false);
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

  if (isLoading) {
    return <LoadingPage />;
  }

  if (user === null) {
    return <LoginPage />;
  }

  return (
    <Box
      ref={setScrollElement}
      sx={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        overflow: "auto",
        paddingTop: user !== null && !isMobile ? M1 : undefined,
      }}
    >
      <TopBar scrollContainer={scrollElement} />

      <Box
        sx={{
          pt: `calc(${M4} + ${M5} + ${M3})`,
          px: M4,
          pb: M4,
          height: "calc(100% - 8rem)",
          width: "100%",
          display: "flex",
          gap: M3,
          alignItems: "flex-start",
        }}
      >
        <LeftSideView open={leftPaneOpen} setOpen={setLeftPaneOpen} />

        <Paper
          elevation={1}
          sx={{
            minHeight: "100%",
            flex: 1,
            p: M3,
            borderRadius: M2,
            display: "flex",
            flexDirection: "column",
            gap: M3,
            backgroundColor: "background.default",
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={M3}
          >
            <TextField
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              fullWidth
              placeholder="Note title"
            />
            <Button
              onClick={() => void handleSave()}
              variant="contained"
              disabled={!editor || isSaving || !id}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </Stack>

          {fetchError && <Alert severity="error">{fetchError}</Alert>}

          {!fetchError && !note && (
            <Typography color="text.secondary">Loading note...</Typography>
          )}

          {editor && (
            <>
              <TextSelectionBubbleMenu editor={editor} enabled={isEditable} />
              <Box
                className="editor-drag-region"
                onMouseMove={handleDragRegionMouseMove}
                onMouseLeave={handleDragRegionMouseLeave}
              >
                <DragHandle
                  editor={editor}
                  className={`note-block-drag-handle ${isEditable ? "" : "note-block-drag-handle--hidden"} ${isInDragHandleArea ? "note-block-drag-handle--active" : ""} ${isEditorFocused && !isInDragHandleArea ? "note-block-drag-handle--suppressed" : ""}`}
                  nested={false}
                >
                  <DragIndicatorIcon fontSize="small" />
                </DragHandle>
                <ThemedEditorBox>
                  <EditorContent editor={editor} className="tiptap" />
                </ThemedEditorBox>
              </Box>
            </>
          )}

          {!editor && (
            <Typography color="text.secondary">Loading editor...</Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
};
