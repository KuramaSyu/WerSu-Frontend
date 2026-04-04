import { DragDropProvider, type DragDropEvents } from "@dnd-kit/react";
import {
  Box,
  ButtonBase,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  ListItem,
  Paper,
  Slide,
  Snackbar,
  Stack,
  TextField,
  ThemeProvider,
} from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import { AnimatePresence, motion } from "framer-motion";

import TopBar from "../../components/TopBar";
import { useEffect, useMemo, useRef, useState } from "react";
import CreateIcon from "@mui/icons-material/Create";
import { M1, M2, M3, M4, M5, M6 } from "../../statics";
import { note_of_date_at_hour } from "../../utils/NoteTitleTemplates";
import { NoteApi } from "../../api/NoteApi";
import { useNotesStore } from "../../zustand/useNotesStore";
import { CardGrid } from "./CardGrid";
import { CreateNote } from "./CreateNote";
import { Note, type NoteData } from "../../api/models/search";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import type { ListDirectoriesQuery } from "../../api/DirectoryApi";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import { DirectorySideView } from "./DirectorySideView";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import { LeftSideView } from "./LeftSideView";

export const MainContent: React.FC = () => {
  const { notes, updateNoteParentDirectory } = useSearchNotesStore();
  const { directoriesById, setDirectories, clearDirectories } =
    useDirectoryStore();
  const { setMessage } = useInfoStore();
  const [leftPaneOpen, setLeftPaneOpen] = useState(true);

  type DragEndEvent = Parameters<DragDropEvents["dragend"]>[0];

  /**
   * Handles successful dnd-kit drop operations from notes into directory nodes.
   * This persists the move via REST, updates client state, and emits snackbar
   * feedback at the bottom-right through the global info store.
   */
  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const source = event.operation.source;
    const target = event.operation.target;

    if (!source || !target) {
      return;
    }

    if (source.type !== "note" || target.type !== "directory") {
      return;
    }

    const noteId = String(source.id);
    const directoryId =
      typeof target.data?.directoryId === "string"
        ? target.data.directoryId
        : String(target.id);
    const directoryName =
      typeof target.data?.directoryName === "string"
        ? target.data.directoryName
        : directoryId;

    const normalizedDirectoryId =
      directoryId === "root" ? undefined : directoryId;

    const moved = await new NoteApi().patchDirectory(
      noteId,
      normalizedDirectoryId,
    );
    if (!moved) {
      setMessage(new SnackbarUpdateImpl("Failed to move note", "error"));
      return;
    }

    updateNoteParentDirectory(noteId, normalizedDirectoryId);
    // Use an explicit destination name so drag-drop results are immediately clear.
    setMessage(
      new SnackbarUpdateImpl(`Note moved to ${directoryName}`, "success"),
    );
  };

  // reange into a Dict[note-directory, List[Note]]
  const notesByDirectory = useMemo(() => {
    const dict: Record<string, Note[]> = {};
    Object.values(notes).forEach((noteData) => {
      // cast to Note
      const notedata: NoteData = {
        ...noteData,
        content: noteData.stripped_content,
        permissions: noteData.permissions ?? [],
      };
      const note = new Note(notedata);
      const dir = note.get_dir() || "root";
      if (!dict[dir]) {
        dict[dir] = [];
      }
      dict[dir].push(note);
    });
    return dict;
  }, [notes]);

  // Only fetch directory metadata if at least one note points to a non-root
  // directory. This avoids unnecessary network traffic on root-only views.
  const hasDirectoryReferences = useMemo(
    () =>
      Object.keys(notesByDirectory).some(
        (directoryId) => directoryId !== "root",
      ),
    [notesByDirectory],
  );

  // Keep a stable query object so TanStack Query can reliably reuse the same
  // cache key and deduplicate requests across rerenders.
  const directoryListQuery = useMemo<ListDirectoriesQuery>(
    () => ({ limit: 500, offset: 0 }),
    [],
  );

  const { data: directories } = useDirectoriesQuery(
    directoryListQuery,
    hasDirectoryReferences,
  );

  // Mirror the server-state cache into the local entity map store used by the
  // UI. This gives components O(1) ID lookups and a single shared source for
  // directory labels.
  useEffect(() => {
    if (!hasDirectoryReferences) {
      clearDirectories();
      return;
    }

    if (directories) {
      setDirectories(directories);
    }
  }, [hasDirectoryReferences, directories, clearDirectories, setDirectories]);

  // Temporary debug logging for grouped notes; safe to remove once directory
  // grouping behavior is validated.
  useEffect(() => {
    console.log(
      `notesByDirectory ${JSON.stringify(notesByDirectory, null, 2)}`,
    );
  }, [notesByDirectory]);

  return (
    <>
      <Box
        sx={{
          height: "100%",
          width: "100%",
          alignSelf: "center",
          fontFamily: "Open Sans",
          display: "flex",
          // overflow: "auto",
        }}
      >
        {/* add padding of the actual margin, topbar, and margin of top bar */}
        <Box
          sx={{
            pt: `calc(${M4} + ${M5} + ${M3})`,
            height: "calc(100% - 8rem)",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: M4,
          }}
        >
          <CreateNote key="create-note"></CreateNote>
          <DragDropProvider onDragEnd={(event) => void handleDragEnd(event)}>
            <Stack direction={"row"} alignItems={"flex-start"}>
              <LeftSideView open={leftPaneOpen} setOpen={setLeftPaneOpen} />
              <Box>
                {Object.entries(notesByDirectory).map(([dir, notes]) => (
                  <Box px={M4}>
                    <CardGrid
                      notes={notes}
                      title={
                        dir === "root"
                          ? "Root"
                          : directoriesById[dir]?.display_name ||
                            directoriesById[dir]?.name ||
                            dir
                      }
                    ></CardGrid>
                  </Box>
                ))}
              </Box>
            </Stack>
          </DragDropProvider>
        </Box>
      </Box>
    </>
  );
};
