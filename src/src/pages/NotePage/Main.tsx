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
import { useNotesStore } from "../../zustand/useNotesStore";
import type { Note } from "../../api/models/search";
import TopBar from "../../components/TopBar";
import { NoteEditor } from "./Editor";
import { NoteSidePanel } from "./NoteSidePanel";

export const NotePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUserStore();
  const { isLoading } = useLoadingStore();
  const { isMobile } = useBreakpoint();
  const cachedNote = useNotesStore((state) =>
    id ? state.notes[id] : undefined,
  );

  const [leftPaneOpen, setLeftPaneOpen] = useState(true);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [note, setNote] = useState<Note | undefined>(cachedNote);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setFetchError("Missing note id in route.");
      setNote(undefined);
      return;
    }

    if (cachedNote) {
      setNote(cachedNote);
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
          onNoteUpdated={setNote}
        />
        <NoteEditor
          note={note}
          noteId={id}
          fetchError={fetchError}
          onNoteUpdated={setNote}
        />
      </Box>
    </Box>
  );
};
