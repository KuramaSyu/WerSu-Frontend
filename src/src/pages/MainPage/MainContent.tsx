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

export const MainContent: React.FC = () => {
  const { notes } = useSearchNotesStore();

  // reange into a Dict[note-directory, List[Note]]
  const notesByDirectory = useMemo(() => {
    const dict: Record<string, Note[]> = {};
    Object.values(notes).forEach((noteData) => {
      // cast to Note
      const notedata: NoteData = {
        ...noteData,
        content: noteData.stripped_content,
        permissions: [],
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

  // log notesByDirectory for debugging
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
            <CardGrid notes={notes} title={dir}></CardGrid>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
