import React, { useState } from "react";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CreateIcon from "@mui/icons-material/Create";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import type { HirarchyItem } from "../../models/HirarchyItem";
import { PanelButtons } from "../../components/Panels/PanelButtons";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { PanelSection } from "../../components/Panels/PanelSection";
import { ConfirmationModal } from "../Settings/ConfirmationModal";
import { useFavouritesStore } from "../../zustand/useFavouritesStore";
import { useParams } from "react-router-dom";

export interface DirectoryRightPanelProps {
  currentNode: HirarchyItem;
  handleCreateNote: () => void;
  handleCreateSubdirectory: () => void;
  handleRenameDirectory: () => void;
  handleDeleteDirectory: () => void;
}

/**
 * Right-panel for directory providing actions for it
 */
export const DirectoryRightPanel: React.FC<DirectoryRightPanelProps> = ({
  currentNode,
  handleCreateNote,
  handleCreateSubdirectory,
  handleRenameDirectory,
  handleDeleteDirectory,
}) => {
  const { id: directoryId } = useParams();
  const isRoot = currentNode.getId() === "root";
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const isFavourite = useFavouritesStore((s) =>
    directoryId ? Boolean(s.directories[directoryId]) : false,
  );
  const toggleDirectory = useFavouritesStore((s) => s.toggleDirectory);

  return (
    <UpperPanel>
      <PanelSection title="Actions" showDivider>
        <PanelButtons>
          <PanelButtons.Secondary
            startIcon={<MenuBookIcon />}
            disabled={isRoot}
            onClick={handleRenameDirectory}
          >
            Edit directory
          </PanelButtons.Secondary>
          <PanelButtons.Secondary
            startIcon={<CreateNewFolderIcon />}
            onClick={handleCreateSubdirectory}
          >
            Create subdirectory
          </PanelButtons.Secondary>
          <PanelButtons.Primary
            startIcon={<CreateIcon />}
            onClick={handleCreateNote}
          >
            Create note
          </PanelButtons.Primary>
          <PanelButtons.Secondary
            startIcon={
              isFavourite ? <StarIcon color="primary" /> : <StarBorderIcon />
            }
            disabled={isRoot}
            // `aria-pressed` lets assistive tech announce toggle state.
            aria-pressed={isFavourite}
            onClick={() => directoryId && toggleDirectory(directoryId)}
          >
            {isFavourite ? "Favourited" : "Favourite"}
          </PanelButtons.Secondary>
          <PanelButtons.Secondary
            startIcon={<DeleteIcon />}
            disabled={isRoot}
            color="error"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            Delete directory
          </PanelButtons.Secondary>
        </PanelButtons>
      </PanelSection>
      <ConfirmationModal
        title="Delete this directory?"
        message="This will delete the directory. Notes inside may become unassigned."
        confirmLabel="Delete"
        open={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          handleDeleteDirectory();
        }}
      />
    </UpperPanel>
  );
};
