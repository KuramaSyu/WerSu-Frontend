import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
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
import { Image } from "@tiptap/extension-image";
import { TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Highlight } from "@tiptap/extension-highlight";
import { Mathematics } from "@tiptap/extension-mathematics";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import "katex/dist/katex.min.css";
import "../../styles/tiptap.css";

import { LeftSideView } from "../MainPage/LeftSideView";
import { TableWithControls } from "../MainPage/Modals/Editor/TableControlls";
import { ThemedEditorBox } from "../MainPage/Modals/Editor/ThemedEditorBox";
import { TextSelectionBubbleMenu } from "../MainPage/Modals/Editor/TextSelectionBubbleMenu";
import { SlashCommandMenu } from "../MainPage/Modals/Editor/SlashCommandMenu";
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
import { RecentActivityPanel } from "../../components/RecentActivityPanel";
import { NoteVersionsDrawer } from "../../components/NoteVersionsDrawer";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import TopBar from "../../components/TopBar";

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
  // Tracks which editor surface is active.
  const [editorMode, setEditorMode] = useState<"rich" | "source">("rich");
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

    setSelectedVersion(null);
    setSelectedVersionContent(null);

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
        setSourceMarkdown(loadedNote.content || loadedNote.stripped_content);
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
      Image,
      TableRow,
      TableCell,
      TableHeader,
      TableWithControls.configure({ resizable: false }),
      Highlight,
      Mathematics,
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

  // Saves either the rich editor markdown or the source editor content.
  const handleSave = async () => {
    if (!id || (editorMode === "rich" && !editor)) {
      return;
    }

    const markdown =
      editorMode === "source" ? sourceMarkdown : (editor?.getMarkdown() ?? "");
    if (editorMode === "source" && editor) {
      editor.commands.setContent(markdown, { contentType: "markdown" });
    }

    setIsSaving(true);
    try {
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

  // Loads the content for a selected version into the preview panel.
  const handleSelectVersion = async (version: NoteVersionSummaryReply) => {
    if (!id) {
      return;
    }
    setSelectedVersion(version);
    setIsFetchingVersion(true);
    try {
      const versionNote = await new NoteApi().getVersion(
        id,
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

  // Restores a version by saving its content as the latest note state.
  const handleRestoreVersion = async (version: NoteVersionSummaryReply) => {
    if (!id) {
      return;
    }
    setIsRestoringVersion(true);
    try {
      let content = selectedVersionContent;
      let restoredTitle = noteTitle;
      if (selectedVersion?.version_id !== version.version_id || !content) {
        const versionNote = await new NoteApi().getVersion(
          id,
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

      const saved = await new NoteApi().patch(id, restoredTitle, content ?? "");
      if (!saved) {
        setMessage(
          new SnackbarUpdateImpl("Failed to restore version", "error"),
        );
        return;
      }
      setNote(saved);
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
        <LeftSideView open={leftPaneOpen} setOpen={setLeftPaneOpen}>
          <Stack spacing={2} sx={{ p: 2 }}>
            <RecentActivityPanel
              target={id ? { type: "note", id } : { type: "root" }}
            />
          </Stack>
        </LeftSideView>

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
              disabled={!id || isSaving || (editorMode === "rich" && !editor)}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </Stack>

          {fetchError && <Alert severity="error">{fetchError}</Alert>}

          {!fetchError && !note && (
            <Typography color="text.secondary">Loading note...</Typography>
          )}

          {editor && editorMode === "rich" && (
            <>
              <TextSelectionBubbleMenu editor={editor} enabled={isEditable} />
              <SlashCommandMenu editor={editor} enabled={isEditable} />
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

          {editorMode === "source" && (
            <TextField
              value={sourceMarkdown}
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
      </Box>

      {/* Floating editor actions */}
      <SpeedDial
        ariaLabel="Editor actions"
        sx={{ position: "fixed", bottom: M4, right: M4, zIndex: 1300 }}
        icon={<SpeedDialIcon />}
      >
        <SpeedDialAction
          icon={<SaveIcon />}
          tooltipTitle="Save"
          onClick={() => void handleSave()}
        />
        {editorMode === "rich" ? (
          <SpeedDialAction
            icon={<CodeIcon />}
            tooltipTitle="Source view"
            onClick={() => {
              const markdown = editor?.getMarkdown() ?? sourceMarkdown;
              setSourceMarkdown(markdown);
              setEditorMode("source");
            }}
          />
        ) : (
          <SpeedDialAction
            icon={<EditIcon />}
            tooltipTitle="Rich editor"
            onClick={() => {
              if (editor) {
                editor.commands.setContent(sourceMarkdown, {
                  contentType: "markdown",
                });
              }
              setEditorMode("rich");
            }}
          />
        )}
        <SpeedDialAction
          icon={<HistoryIcon />}
          tooltipTitle="Versions"
          onClick={() => setVersionsOpen(true)}
        />
      </SpeedDial>

      {/* Right-side version history drawer */}
      <NoteVersionsDrawer
        open={versionsOpen}
        noteId={id}
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
    </Box>
  );
};
