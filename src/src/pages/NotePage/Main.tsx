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
import { useUser } from "../../api/queries/useUser";
import { useLayout } from "../../LayoutProvider";

export const NotePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useUser();
  const { isLoading } = useLoadingStore();
  const { isMobile } = useBreakpoint();

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
  );
};
