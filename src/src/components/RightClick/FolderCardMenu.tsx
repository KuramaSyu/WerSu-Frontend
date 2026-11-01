// Right-click menu for a home-page directory card.
//
// Buttons: copy, paste, favourite, edit, delete. Edit routes through
// the shared directory dialog host; delete confirms first.

import { useCallback, useState, type ReactNode } from "react";
import { Box } from "@mui/material";
import { copyToClipboard } from "../../zustand/InfoStore";
import { useFavouritesStore } from "../../zustand/useFavouritesStore";
import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";
import { useDirectoryDelete } from "../../api/queries/useDirectoryMutations";
import { ConfirmationModal } from "../../pages/Settings/ConfirmationModal";
import { useRightClickMenu, type RightClickMenuSpec } from "./useRightClickMenu";

export interface FolderCardMenuProps {
  directoryId: string;
  name: string;
  children: ReactNode;
}

const CARD_BUTTONS: RightClickMenuSpec["buttons"] = [
  "copy",
  "paste",
  "favourite",
  "edit",
  "delete",
];

export const FolderCardMenu: React.FC<FolderCardMenuProps> = ({
  directoryId,
  name,
  children,
}) => {
  const menu = useRightClickMenu();
  const openDirectoryDialog = useRightClickMenuStore(
    (s) => s.openDirectoryDialog,
  );
  const toggleDirectory = useFavouritesStore((s) => s.toggleDirectory);
  const deleteDirectory = useDirectoryDelete();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      menu.onContextMenu(event, {
        targetId: directoryId,
        buttons: CARD_BUTTONS,
        overrides: {
          copy: {
            handler: () => {
              void copyToClipboard(name);
              return true;
            },
          },
          favourite: {
            handler: () => {
              toggleDirectory(directoryId);
              return true;
            },
          },
          edit: {
            handler: () => {
              openDirectoryDialog({ mode: "edit", directoryId });
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
    [menu, directoryId, name, toggleDirectory, openDirectoryDialog],
  );

  const runDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const ok = await deleteDirectory(directoryId);
      if (!ok) {
        setError("Failed to delete directory. Please try again.");
        return;
      }
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
      <ConfirmationModal
        title="Delete this directory?"
        message={`${name} and everything inside it will be deleted.`}
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

export default FolderCardMenu;
