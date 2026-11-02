import React from "react";
import { CreateActions } from "../../components/CreateActions";

export interface DirectoryActionsProps {
  handleCreateNote: () => void;
  handleCreateSubdirectory: () => void;
}

/**
 * Responsive create actions for the directory view: floating FABs on
 * desktop, compact icon buttons in the mobile bottom bar on mobile.
 * The directory's non-create actions (edit, favourite, delete) live in
 * a 3-dot menu next to the directory title; see `DirectoryMenu`.
 */
export const DirectoryActions: React.FC<DirectoryActionsProps> = ({
  handleCreateNote,
  handleCreateSubdirectory,
}) => {
  return (
    <CreateActions
      onCreateNote={handleCreateNote}
      onCreateDirectory={handleCreateSubdirectory}
    />
  );
};
