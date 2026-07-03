import React from "react";
import { Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CreateIcon from "@mui/icons-material/Create";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { RecentActivityPanel } from "../../components/RecentActivity/Main";
import { DirectorySideView } from "../MainPage/DirectorySideView";
import type { HirarchyItem } from "../../models/HirarchyItem";
import type { NavigateFunction } from "react-router-dom";
import { PanelButtons } from "../../components/Panels/PanelButtons";
import { PanelSection } from "../../components/Panels/PanelSection";

interface DirectoryActionsProps {
  currentNode: HirarchyItem;
  navigate: NavigateFunction;
  handleCreateNote: () => Promise<void> | void;
  handleRenameDirectory: () => Promise<void> | void;
}

/**
 * DirectoryActions
 *
 * A small, focused component that renders the left-pane directory actions
 * used in the Directory view. It contains the Back/Edit/Create buttons,
 * the RecentActivityPanel scoped to the current directory, and the
 * DirectorySideView tree.
 *
 * Props:
 * - `currentNode`: the currently selected `HirarchyItem` (used to scope recent activity)
 * - `navigate`: react-router `navigate` function used for Back
 * - `handleCreateNote`: callback to create a new note
 * - `handleRenameDirectory`: callback to rename the current directory
 */
export const DirectoryActions: React.FC<DirectoryActionsProps> = ({
  currentNode,
  navigate,
  handleCreateNote,
  handleRenameDirectory,
}) => {
  return (
    <Stack spacing={2}>
      <PanelSection showDivider={false}>
        <PanelButtons>
          <PanelButtons.Secondary
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
          >
            Back
          </PanelButtons.Secondary>
          <PanelButtons.Secondary
            startIcon={<MenuBookIcon />}
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

      <PanelSection showDivider={false}>
        <DirectorySideView />
      </PanelSection>

      <PanelSection
        title="Recent activity"
        titleIcon={<ScheduleIcon fontSize="small" />}
        collapsible
      >
        <RecentActivityPanel
          target={
            currentNode.getId() === "root"
              ? { type: "root" }
              : { type: "directory", id: currentNode.getId() }
          }
        />
      </PanelSection>
    </Stack>
  );
};
