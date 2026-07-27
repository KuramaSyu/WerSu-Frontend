import { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Box, Fade } from "@mui/material";
import { LoginPage } from "../LoginPage/Main";
import { LoadingPage } from "../LoadingPage/Main";
import { M1, M3, M4, M5 } from "../../statics";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useLoadingStore } from "../../zustand/loadingStore";
import type { Note } from "../../api/models/search";
import TopBar from "../../components/TopBar";
import { NoteEditor } from "./Editor";
import { NoteSidePanel } from "./panel/Main";
import {
  useNote,
  useUpdateNote,
  type UpdateNoteVariables,
} from "../../api/queries/useNoteQueries";
import { useUser } from "../../api/queries/useUser";
import { useLayout } from "../../LayoutProvider";
import { useRightPanel } from "../../LayoutProvider";
import { NoteEditorSkeleton } from "./NoteEditorSkeleton";
import { useThemeStore } from "../../zustand/useThemeStore";

export const NotePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useUser();
  const { isLoading } = useLoadingStore();
  const { isMobile } = useBreakpoint();
  const { theme } = useThemeStore();

  const { data: note } = useNote(id);
  const { mutateAsync: mutateNote } = useUpdateNote();

  // without this ref, adding a new dir and removing it
  // would not work.
  const noteRef = useRef<Note | undefined>(note);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  const sameStringArray = (left: string[], right: string[]) =>
    left.length === right.length &&
    left.every((value, index) => value === right[index]);

  const updateNote = useCallback(
    async (nextNote: Note) => {
      if (!id) {
        return;
      }

      const patch: UpdateNoteVariables = { noteId: id };
      const currentNote = noteRef.current;
      const currentDirectoryIds = currentNote?.directory_ids ?? [];
      const currentTagIds = currentNote?.tag_ids ?? [];

      if (currentNote?.title !== nextNote.title) {
        patch.title = nextNote.title;
      }
      if (currentNote?.content !== nextNote.content) {
        patch.content = nextNote.content;
      }
      if (!sameStringArray(currentDirectoryIds, nextNote.directory_ids)) {
        patch.directory_ids = nextNote.directory_ids;
      }
      if (!sameStringArray(currentTagIds, nextNote.tag_ids)) {
        patch.tag_ids = nextNote.tag_ids;
      }

      if (Object.keys(patch).length === 1) {
        return;
      }

      await mutateNote(patch);
    },
    [id, mutateNote],
  );
  const { setLeftPanel, leftPanelOpen } = useLayout();

  useEffect(() => {
    setLeftPanel(
      <NoteSidePanel note={note} noteId={id} onNoteUpdated={updateNote} />,
    );
  }, [id]);

  // The note editor owns the full canvas - no right rail. Pin
  // `rightPanel` to null on this route so a previous page's
  // content (e.g. a directory's actions) doesn't bleed into the
  // layout context. The TopBar's `RightPanelToggle` only renders
  // when a panel is mounted, so this also keeps the right-side
  // collapse icon out of the way.
  useRightPanel(null);

  if (user === null) {
    return <LoginPage />;
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
      }}
    >
      <Fade
        in={note === undefined}
        timeout={{
          enter: theme.transitions.duration.enteringScreen,
          exit: theme.transitions.duration.complex,
        }}
        unmountOnExit
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
          }}
        >
          <NoteEditorSkeleton showSourceEditor={false} />
        </Box>
      </Fade>
      <Fade
        in={note !== undefined}
        timeout={{
          enter: theme.transitions.duration.complex,
          exit: theme.transitions.duration.complex,
        }}
        unmountOnExit
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            height: "100%",
          }}
        >
          <Box
            sx={{
              pb: M4,
              height: "calc(100% - 8rem)",
              width: "100%",
              display: "flex",
              gap: M3,
              alignItems: "flex-start",
            }}
          >
            <NoteEditor
              note={note}
              noteId={id}
              fetchError={null}
              onNoteUpdated={updateNote}
              key={id}
            />
          </Box>
        </Box>
      </Fade>
    </Box>
  );
};
