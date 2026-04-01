import {
  Box,
  ButtonBase,
  Grid,
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
import { useEffect, useMemo, useRef } from "react";
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

export const MainContent: React.FC = () => {
  const { notes } = useSearchNotesStore();
  const { directoriesById, setDirectories, clearDirectories } =
    useDirectoryStore();

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
    <Box
      sx={{
        height: "100%",
        width: "100%",
        alignSelf: "center",
        fontFamily: "Open Sans",
        display: "flex",
        overflow: "auto",
      }}
    >
      <TopBar></TopBar>
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
    </Box>
  );
};
