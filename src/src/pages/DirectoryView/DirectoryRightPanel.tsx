import React from "react";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CreateIcon from "@mui/icons-material/Create";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import type { HirarchyItem } from "../../models/HirarchyItem";
import { PanelButtons } from "../../components/Panels/PanelButtons";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { PanelSection } from "../../components/Panels/PanelSection";
import { useFavouritesStore } from "../../zustand/useFavouritesStore";
import { useParams } from "react-router-dom";

export interface DirectoryRightPanelProps {
  currentNode: HirarchyItem;
  handleCreateNote: () => Promise<void> | void;
  handleRenameDirectory: () => Promise<void> | void;
}

/**
 * Right-panel for directory providing actions for it
 */
export const DirectoryRightPanel: React.FC<DirectoryRightPanelProps> = ({
  currentNode,
  handleCreateNote,
  handleRenameDirectory,
}) => {
  const { id: directoryId } = useParams();
  const isRoot = currentNode.getId() === "root";

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
            onClick={() => void handleRenameDirectory()}
          >
            Edit directory
          </PanelButtons.Secondary>
          <PanelButtons.Primary
            startIcon={<CreateIcon />}
            onClick={() => void handleCreateNote()}
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
        </PanelButtons>
      </PanelSection>
    </UpperPanel>
  );
};
