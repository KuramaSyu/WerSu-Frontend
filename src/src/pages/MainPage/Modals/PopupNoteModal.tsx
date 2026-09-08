import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Slide,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CreateIcon from "@mui/icons-material/Create";
import { useMainPageStore } from "../../../zustand/useMainPageStore";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { useSelectedShelfStore } from "../../../zustand/useSelectedShelfStore";
import { useCreateNote } from "../../../api/queries/useNoteQueries";
import { NoteEditorModal } from "../../../components/Editor/NoteEditModal";
import { NoteApi, type INoteApi } from "../../../api/NoteApi";
import useInfoStore, { SnackbarUpdateImpl } from "../../../zustand/InfoStore";

export const PopupNoteModal: React.FC = () => {
  const { theme } = useThemeStore();
  const { mutateAsync } = useCreateNote();
  const { setMessage } = useInfoStore();
  const selectedShelfId = useSelectedShelfStore((s) => s.selectedShelfId);
  const {
    noteModalOpen: open,
    selectedModalNote: note,
    setNoteModalOpen: setOpen,
    setSelectedModalNote: setNote,
  } = useMainPageStore();

  return (
    <NoteEditorModal
      open={open}
      onClose={() => {
        setOpen(false);
        setNote(null);
      }}
      title={note?.title ?? ""}
      content={note?.stripped_content ?? ""}
      onSave={(title: string, content: string) => {
        // Reuse the source note's parents; fall back to the shelf
        // when the source is a root-level orphan.
        const directoryIds = note?.directory_ids ?? [];
        mutateAsync({
          title,
          content,
          directory_ids: directoryIds.length > 0 ? directoryIds : undefined,
          shelf_id:
            directoryIds.length > 0
              ? undefined
              : (selectedShelfId ?? undefined),
        })
          .then((note) => {
            setOpen(false);
            setNote(null);
            setMessage(
              new SnackbarUpdateImpl("Note created successfully", "success"),
            );
          })
          .catch((err) => {
            setMessage(
              new SnackbarUpdateImpl(
                "Failed to create note: " + err.message,
                "error",
              ),
            );
          });
      }}
    />
  );
};
