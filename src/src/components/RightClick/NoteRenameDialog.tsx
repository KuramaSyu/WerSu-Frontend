// Tiny rename dialog for note cards (decision 4).
//
// Cards edit the title only; the full editor is reached from the
// directory page. Uses useUpdateNote so the note caches refresh the
// same way any other patch does.

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useUpdateNote } from "../../api/queries/useNoteQueries";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";

export interface NoteRenameDialogProps {
  open: boolean;
  noteId: string | null;
  initialTitle: string;
  onClose: () => void;
}

export const NoteRenameDialog: React.FC<NoteRenameDialogProps> = ({
  open,
  noteId,
  initialTitle,
  onClose,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const { mutateAsync, isPending } = useUpdateNote();
  const { setMessage } = useInfoStore();

  // Re-seed the field each time the dialog opens so a renamed note
  // does not show the previous value. The bounded cascade is
  // intentional (same pattern as LatexDialogController).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setTitle(initialTitle);
  }, [open, initialTitle]);

  const save = async () => {
    const next = title.trim();
    if (!noteId || next === "") return;
    try {
      await mutateAsync({ noteId, title: next });
      setMessage(new SnackbarUpdateImpl("Note renamed", "success"));
      onClose();
    } catch (error) {
      setMessage(
        new SnackbarUpdateImpl(
          error instanceof Error ? error.message : "Failed to rename note",
          "error",
        ),
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Rename note</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void save()}
          disabled={isPending || title.trim() === ""}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NoteRenameDialog;
