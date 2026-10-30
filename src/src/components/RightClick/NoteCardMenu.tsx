// Right-click menu for a main-page note card.
//
// Buttons: copy, paste, edit, delete. Edit renames the note (decision
// 4); delete confirms, then removes it through useDeleteNote.

import { useCallback, useState, type ReactNode } from "react";
import { Box } from "@mui/material";
import type { MinimalNote } from "../../api/models/search";
import { copyToClipboard } from "../../zustand/InfoStore";
import { useDeleteNote } from "../../api/queries/useNoteQueries";
import { ConfirmationModal } from "../../pages/Settings/ConfirmationModal";
import { useRightClickMenu, type RightClickMenuSpec } from "./useRightClickMenu";
import { NoteRenameDialog } from "./NoteRenameDialog";

export interface NoteCardMenuProps {
  note: MinimalNote;
  children: ReactNode;
}

const CARD_BUTTONS: RightClickMenuSpec["buttons"] = [
  "copy",
  "paste",
  "edit",
  "delete",
];

export const NoteCardMenu: React.FC<NoteCardMenuProps> = ({
  note,
  children,
}) => {
  const menu = useRightClickMenu();
  const deleteNote = useDeleteNote();

  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      menu.onContextMenu(event, {
        targetId: note.id,
        buttons: CARD_BUTTONS,
        overrides: {
          copy: {
            handler: () => {
              void copyToClipboard(note.title);
              return true;
            },
          },
          edit: {
            handler: () => {
              setRenameOpen(true);
              return true;
            },
          },
          delete: {
            handler: () => {
              setError(null);
              setConfirmOpen(true);
              return true;
            },
          },
        },
      });
    },
    [menu, note.id, note.title],
  );

  const runDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteNote.mutateAsync(note.id);
      setConfirmOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown error while deleting.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ display: "contents" }} onContextMenu={onContextMenu}>
      {children}
      <NoteRenameDialog
        open={renameOpen}
        noteId={note.id}
        initialTitle={note.title}
        onClose={() => setRenameOpen(false)}
      />
      <ConfirmationModal
        title="Delete this note?"
        message={`${note.title} will be deleted.`}
        confirmLabel="Delete"
        open={confirmOpen}
        confirming={deleting}
        errorMessage={error}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        onConfirm={() => void runDelete()}
      />
    </Box>
  );
};

export default NoteCardMenu;
