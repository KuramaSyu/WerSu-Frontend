import React from "react";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { RecentActivityPanel } from "../../components/RecentActivity/Main";
import { DirectorySideView } from "../MainPage/DirectorySideView";
import type { HirarchyItem } from "../../models/HirarchyItem";
import { PanelSection } from "../../components/Panels/PanelSection";
import { NavigationSection } from "../../components/Panels/NavigationSection";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { useDirectory } from "../../api/queries/useDirectoryQuery";
import { DirectoryActions } from "./DirectoryActions";
import type { CascadePreview } from "./DirectoryFeatures.hook";

interface DirectoryActionsProps {
  currentNode: HirarchyItem;
  cascadePreview: CascadePreview;
  handleCreateNote: () => void;
  handleCreateSubdirectory: () => void;
  handleRenameDirectory: () => void;
  handleDeleteDirectory: () => Promise<boolean>;
}

/**
 * Left-panel directory actions: navigation, directory tree, recent activity.
 */
export const DirectoryLeftPanel: React.FC<DirectoryActionsProps> = ({
  currentNode,
  cascadePreview,
  handleCreateNote,
  handleCreateSubdirectory,
  handleRenameDirectory,
  handleDeleteDirectory,
}) => {
  const { data: dir } = useDirectory(
    currentNode.getId() === "root" ? undefined : currentNode.getId(),
  );
  return (
    <UpperPanel>
      <NavigationSection />
      <DirectoryActions
        currentNode={currentNode}
        cascadePreview={cascadePreview}
        handleCreateNote={handleCreateNote}
        handleCreateSubdirectory={handleCreateSubdirectory}
        handleRenameDirectory={handleRenameDirectory}
        handleDeleteDirectory={handleDeleteDirectory}
      />
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
