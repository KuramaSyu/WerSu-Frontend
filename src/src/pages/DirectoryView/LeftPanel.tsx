import React from "react";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { RecentActivityPanel } from "../../components/RecentActivity/Main";
import { DirectorySideView } from "../MainPage/DirectorySideView";
import type { HirarchyItem } from "../../models/HirarchyItem";
import { PanelSection } from "../../components/Panels/PanelSection";
import { NavigationSection } from "../../components/Panels/NavigationSection";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { useDirectory } from "../../api/queries/useDirectoryQuery";

interface DirectoryLeftPanelProps {
  currentNode: HirarchyItem;
}

/**
 * Left-panel directory actions: navigation, directory tree, recent
 * activity. The FAB + speed-dial used to live here too, but they
 * disappeared with the panel on mobile (the rail is hidden by
 * default on mobile + `COLLAPSED_PANEL_SIZE = 0px`). They now live
 * in `DirectoryView/Main.tsx` so they stay visible regardless of
 * the rail's open / closed state.
 */
export const DirectoryLeftPanel: React.FC<DirectoryLeftPanelProps> = ({
  currentNode,
}) => {
  const { data: dir } = useDirectory(
    currentNode.getId() === "root" ? undefined : currentNode.getId(),
  );
  return (
    <UpperPanel>
      <NavigationSection />
      <DirectorySideView />
      <PanelSection
        title="Recent activity"
        titleIcon={<ScheduleIcon fontSize="small" />}
      >
        <RecentActivityPanel
          target={
            currentNode.getId() === "root"
              ? { type: "root" }
              : { type: "directory", id: currentNode.getId() }
          }
        />
      </PanelSection>
      <PanelSection title="Description" titleIcon={<></>}>
        <p style={{ fontSize: "0.8rem" }}>
          {dir?.description || "No description"}
        </p>
      </PanelSection>
    </UpperPanel>
  );
};
