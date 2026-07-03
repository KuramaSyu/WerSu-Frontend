import React from "react";
import { Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CreateIcon from "@mui/icons-material/Create";
import type { HirarchyItem } from "../../models/HirarchyItem";
import type { NavigateFunction } from "react-router-dom";
import { PanelButtons } from "../../components/Panels/PanelButtons";

export interface DirectoryRightPanelProps {
  currentNode: HirarchyItem;
  navigate: NavigateFunction;
  handleCreateNote: () => Promise<void> | void;
  handleRenameDirectory: () => Promise<void> | void;
}

/**
 * Right-panel content for the directory view.
 *
 * Renders the title-level actions: Back, Edit directory, Create note.
 * Mounted into the right panel via `useRightPanel` so the directory tree in
 * the left panel stays focused on navigation.
 */
export const DirectoryRightPanel: React.FC<DirectoryRightPanelProps> = ({
  currentNode,
  navigate,
  handleCreateNote,
  handleRenameDirectory,
}) => {
  const isRoot = currentNode.getId() === "root";

  return (
    <Stack spacing={2}>
      <PanelButtons>
        <PanelButtons.Secondary
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          Back
        </PanelButtons.Secondary>
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
      </PanelButtons>
    </Stack>
  );
};
