import React from "react";
import { Stack, Button, Divider } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CreateIcon from "@mui/icons-material/Create";
import { RecentActivityPanel } from "../../components/RecentActivityPanel";
import { DirectorySideView } from "../MainPage/DirectorySideView";
import type { HirarchyItem } from "../../models/HirarchyItem";
import type { NavigateFunction } from "react-router-dom";

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
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
        <Button
          variant="outlined"
          startIcon={<MenuBookIcon />}
          onClick={() => void handleRenameDirectory()}
        >
          Edit directory
        </Button>
        <Button
          variant="contained"
          startIcon={<CreateIcon />}
          onClick={() => void handleCreateNote()}
        >
          Create note
        </Button>
      </Stack>

      <Divider sx={{ opacity: 0.3 }} />

      <RecentActivityPanel
        target={
          currentNode.getId() === "root"
            ? { type: "root" }
            : { type: "directory", id: currentNode.getId() }
        }
      />

      <Divider sx={{ opacity: 0.3 }} />

      <DirectorySideView />
    </Stack>
  );
};
