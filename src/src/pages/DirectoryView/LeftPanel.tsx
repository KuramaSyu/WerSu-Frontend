import React from "react";
import ScheduleIcon from "@mui/icons-material/Schedule";
import NotesIcon from "@mui/icons-material/Notes";
import { RecentActivityPanel } from "../../components/RecentActivity/Main";
import type { HirarchyItem } from "../../models/HirarchyItem";
import { RailSection } from "../../components/Panels/RailSection";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { useDirectory } from "../../api/queries/useDirectoryQuery";
import { InlineEditableDescription } from "../../components/DirectoryView/InlineEditableDescription/InlineEditableDescription";

interface DirectoryLeftPanelProps {
  currentNode: HirarchyItem;
}

/**
 * Left-panel directory actions: recent activity and description.
 * The FAB + speed-dial used to live here too, but they
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
    <UpperPanel spacing={2.5}>
      <RailSection
        title="Recent activity"
        description="Latest changes in this book or chapter."
        icon={<ScheduleIcon />}
      >
        <RecentActivityPanel
          title={null}
          target={
            currentNode.getId() === "root"
              ? { type: "root" }
              : { type: "directory", id: currentNode.getId() }
          }
        />
      </RailSection>
      {dir?.id && (
        <RailSection
          title="Description"
          description="What this book or chapter is about."
          icon={<NotesIcon />}
        >
          <InlineEditableDescription
            directoryId={dir.id}
            initialDescription={dir.description ?? ""}
          />
        </RailSection>
      )}
    </UpperPanel>
  );
};
