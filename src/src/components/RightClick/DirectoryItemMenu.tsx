// Right-click menu for a directory-view row.
//
// Wraps the row so the handler can bubble, and owns the delete
// confirmation. Directory rows edit through the shared directory
// dialog; note rows open the full editor (decision 4) or rename in
// place. The synthetic root disables edit and delete, matching
// DirectoryMenu.

import { useCallback, useState, type ReactNode } from "react";
import { Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { copyToClipboard } from "../../zustand/InfoStore";
import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";
import { useDirectoryDelete } from "../../api/queries/useDirectoryMutations";
import { useDeleteNote } from "../../api/queries/useNoteQueries";
import { ConfirmationModal } from "../../pages/Settings/ConfirmationModal";
import { useRightClickMenu, type RightClickMenuSpec } from "./useRightClickMenu";
import { NoteRenameDialog } from "./NoteRenameDialog";

export type DirectoryItemMenuTarget =
  | { kind: "directory"; directoryId: string; name: string; isRoot: boolean }
  | { kind: "note"; noteId: string; title: string };

export interface DirectoryItemMenuProps {
  target: DirectoryItemMenuTarget;
  children: ReactNode;
}

const ROW_BUTTONS: RightClickMenuSpec["buttons"] = [
  "copy",
  "paste",
  "edit",
  "delete",
];

const NOTE_ROW_BUTTONS: RightClickMenuSpec["buttons"] = [
  "copy",
  "paste",
  "edit",
  "rename",
  "delete",
];

export const DirectoryItemMenu: React.FC<DirectoryItemMenuProps> = ({
  target,
  children,
}) => {
  const navigate = useNavigate();
  const menu = useRightClickMenu();
  const openDirectoryDialog = useRightClickMenuStore(
    (s) => s.openDirectoryDialog,
  );
  const deleteDirectory = useDirectoryDelete();
  const deleteNote = useDeleteNote();

  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirectory = target.kind === "directory";
  const isRoot = target.kind === "directory" && target.isRoot;

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      const overrides: RightClickMenuSpec["overrides"] = {
        copy: {
          handler: () => {
            void copyToClipboard(
              target.kind === "directory" ? target.name : target.title,
            );
            return true;
          },
        },
      };

      // Root rows keep edit/delete visible but greyed.
      if (!isRoot) {
        overrides.edit = {
          handler: () => {
            if (target.kind === "directory") {
              openDirectoryDialog({
                mode: "edit",
                directoryId: target.directoryId,
              });
            } else {
              navigate(`/n/${target.noteId}`);
            }
            return true;
          },
        };
        overrides.delete = {
          handler: () => {
            setError(null);
            setConfirmOpen(true);
            return true;
          },
        };
      }

      if (target.kind === "note") {
        overrides.rename = {
          handler: () => {
            setRenameOpen(true);
            return true;
          },
        };
      }

      menu.onContextMenu(event, {
        targetId:
          target.kind === "directory" ? target.directoryId : target.noteId,
        buttons: target.kind === "note" ? NOTE_ROW_BUTTONS : ROW_BUTTONS,
        overrides,
      });
    },
    [target, isRoot, menu, openDirectoryDialog, navigate],
  );

  const runDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      if (target.kind === "directory") {
        const ok = await deleteDirectory(target.directoryId);
        if (!ok) {
          setError("Failed to delete directory. Please try again.");
          return;
        }
        setConfirmOpen(false);
        navigate("/");
      } else {
        await deleteNote.mutateAsync(target.noteId);
        setConfirmOpen(false);
      }
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
      {target.kind === "note" && (
        <NoteRenameDialog
          open={renameOpen}
          noteId={target.noteId}
          initialTitle={target.title}
          onClose={() => setRenameOpen(false)}
        />
      )}
      <ConfirmationModal
        title={
          isDirectory ? "Delete this directory?" : "Delete this note?"
        }
        message={
          target.kind === "directory"
            ? `${target.name} and everything inside it will be deleted.`
            : `${target.title} will be deleted.`
        }
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

export default DirectoryItemMenu;
