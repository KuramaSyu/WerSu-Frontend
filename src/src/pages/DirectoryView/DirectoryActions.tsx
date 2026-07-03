import React from "react";
import { Stack } from "@mui/material";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { RecentActivityPanel } from "../../components/RecentActivity/Main";
import { DirectorySideView } from "../MainPage/DirectorySideView";
import type { HirarchyItem } from "../../models/HirarchyItem";
import { PanelSection } from "../../components/Panels/PanelSection";

interface DirectoryActionsProps {
  currentNode: HirarchyItem;
}

/**
 * Left-panel directory actions: directory tree + recent activity.
 *
 * The Back / Edit / Create buttons live in `DirectoryRightPanel`.
 */
export const DirectoryActions: React.FC<DirectoryActionsProps> = ({
  currentNode,
}) => {
  return (
    <Stack spacing={2}>
      <DirectorySideView />
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
