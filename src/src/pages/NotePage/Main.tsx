import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Fade } from "@mui/material";
import { LoginPage } from "../LoginPage/Main";
import { LoadingPage } from "../LoadingPage/Main";
import { M1, M3, M4, M5 } from "../../statics";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useLoadingStore } from "../../zustand/loadingStore";
import { useUserStore } from "../../zustand/userStore";
import { NoteApi } from "../../api/NoteApi";
import type { Note } from "../../api/models/search";
import TopBar from "../../components/TopBar";
import { NoteEditor } from "./Editor";
import { NoteSidePanel } from "./NoteSidePanel";
import { useNote, useUpdateNote } from "../../api/queries/useNoteQueries";
import { useUser } from "../../api/queries/useUser";
import { useLayout } from "../../LayoutProvider";
import { NoteEditorSkeleton } from "./NoteEditorSkeleton";
import { useThemeStore } from "../../zustand/useThemeStore";

export const NotePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useUser();
  const { isLoading } = useLoadingStore();
  const { isMobile } = useBreakpoint();
  const { theme } = useThemeStore();

  const { data: note } = useNote(id);
  const { mutate } = useUpdateNote();
  const updateNote = (note: Note) => {
    mutate({ noteId: id!, title: note.title, content: note.content });
  };
  const { setLeftPanel, leftPanelOpen } = useLayout();

  useEffect(() => {
    setLeftPanel(
      <NoteSidePanel note={note} noteId={id} onNoteUpdated={updateNote} />,
    );
    return () => setLeftPanel(null);
  }, [id]);

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
            position: "absolute",
            inset: 0,
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
