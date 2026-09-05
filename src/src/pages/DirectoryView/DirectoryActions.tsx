import React from "react";
import { FabSlot } from "../../components/FabSlot";
import CreateFab from "../../components/CreateFab";

export interface DirectoryActionsProps {
  handleCreateNote: () => void;
  handleCreateSubdirectory: () => void;
}

/**
 * Bottom-right FAB stack for the directory view: a single
 * `CreateFab` exposing the two create actions. The directory's
 * non-create actions (rename, favourite, delete) moved to a
 * 3-dot menu next to the directory title; see `DirectoryMenu`.
 */
export const DirectoryActions: React.FC<DirectoryActionsProps> = ({
  handleCreateNote,
  handleCreateSubdirectory,
}) => {
  return (
    <FabSlot>
      <CreateFab
        onCreateNote={handleCreateNote}
        onCreateDirectory={handleCreateSubdirectory}
      />
    </FabSlot>
  );
};
