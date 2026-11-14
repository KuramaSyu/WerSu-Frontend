import { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Box, Fade } from "@mui/material";
import { LoginPage } from "../LoginPage/Main";
import { M3, M4 } from "../../statics";
import type { Note } from "../../api/models/search";
import { NoteEditor } from "./Editor";
import { NoteLeftPanel } from "./Panel/MainLeft";
import { NoteRightPanel } from "./Panel/MainRight";
import { NoteActionsToolbar } from "./Panel/NoteActionsToolbar";
import {
  useNote,
  useUpdateNote,
  type UpdateNoteVariables,
} from "../../api/queries/useNoteQueries";
import { useUser } from "../../api/queries/useUser";
import { useLeftPanel, usePanelSize } from "../../LayoutProvider";
import { useRightPanel, useLayout } from "../../LayoutProvider";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { NoteEditorSkeleton } from "./NoteEditorSkeleton";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useScrollToSectionOnLoad } from "../../hooks/useScrollToSectionOnLoad";
import { queryClient } from "../../api/queryClient";
import { historyQueryKeys } from "../../api/queries/historyQueries";
import { useEditorSettings } from "../../zustand/useEditorSettings";

export const NotePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useUser();
  const { theme } = useThemeStore();

  // Include resolved references so embedded note references can use
  // the backend-provided content instead of fetching every target.
  const { data: note } = useNote(id, undefined, true);
  const { mutateAsync: mutateNote } = useUpdateNote();

  // without this ref, adding a new dir and removing it
  // would not work.
  const noteRef = useRef<Note | undefined>(note);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  // Refetch activity-history panels (Last used, Frequently used, Recent
  // activity) as soon as the user opens a note
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: historyQueryKeys.all });
  }, [id]);

  // Always open a note in view (read) mode. `editMode` lives in a
  // global store, so without this an edit session on a previous note
  // would leak into the next one. Reset whenever the note id changes
  // (and on mount).
  useEffect(() => {
    useEditorSettings.getState().setWrite(false);
  }, [id]);

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

  useLeftPanel(
    <NoteLeftPanel note={note} noteId={id} onNoteUpdated={updateNote} />,
    [id],
  );
  useRightPanel(<NoteRightPanel noteId={id} />, [id]);
  // When the right rail is collapsed its `pl: M3` gutter goes away with
  // it, so the note would sit flush against the window. Add the matching
  // right padding to the editor instead. Mobile is always full-bleed.
  const { rightPanelOpen } = useLayout();
  const { isMobile } = useBreakpoint();
  usePanelSize({
    left: `clamp(15rem, 25vw, 30rem)`,
    right: "21rem",
    openLeft: "lg",
    openRight: "xl",
  });

  // Honour the `?section=<slug>` deep-link by scrolling the matching
  // heading into view after the editor's outline has loaded.
  useScrollToSectionOnLoad();

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
      {/* Mount-only registration: publishes the Save/Share toolbar
          into the desktop top bar for as long as the note page is
          active. No DOM output. */}
      <NoteActionsToolbar />
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
            pr: !isMobile && !rightPanelOpen ? M3 : 0,
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
