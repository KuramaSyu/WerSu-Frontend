import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Box } from "@mui/material";
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

export const NotePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUserStore();
  const { isLoading } = useLoadingStore();
  const { isMobile } = useBreakpoint();

  const [leftPaneOpen, setLeftPaneOpen] = useState(true);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const { data: note } = useNote(id);
  const { mutate } = useUpdateNote();
  const updateNote = (note: Note) => {
    mutate({ noteId: id!, title: note.title, content: note.content });
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
        <NoteSidePanel
          note={note}
          noteId={id}
          open={leftPaneOpen}
          setOpen={setLeftPaneOpen}
          onNoteUpdated={updateNote}
        />
        <NoteEditor
          note={note}
          noteId={id}
          fetchError={null}
          onNoteUpdated={updateNote}
        />
      </Box>
    </Box>
  );
};
