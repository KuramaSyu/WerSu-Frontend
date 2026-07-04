import React from "react";
import { Stack } from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CreateIcon from "@mui/icons-material/Create";
import type { HirarchyItem } from "../../models/HirarchyItem";
import { PanelButtons } from "../../components/Panels/PanelButtons";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { PanelSection } from "../../components/Panels/PanelSection";

export interface DirectoryRightPanelProps {
  currentNode: HirarchyItem;
  handleCreateNote: () => Promise<void> | void;
  handleRenameDirectory: () => Promise<void> | void;
}

/**
 * Right-panel content for the directory view.
 *
 * Renders the directory actions: Edit directory, Create note. Back/Forward
 * navigation lives in the left panel as `NavigationSection`.
 */
export const DirectoryRightPanel: React.FC<DirectoryRightPanelProps> = ({
  currentNode,
  handleCreateNote,
  handleRenameDirectory,
}) => {
  const isRoot = currentNode.getId() === "root";

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
        </PanelButtons>
      </PanelSection>
    </UpperPanel>
  );
};
