import { useEffect, useId, useRef } from "react";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import { useBreakpoint } from "../hooks/useBreakpoint";
import {
  useMobileActionsStore,
  type MobileAction,
} from "../zustand/useMobileActionsStore";
import { FabSlot } from "./FabSlot";
import CreateFab, { type CreateFabProps } from "./CreateFab";
import { directoryTerms } from "../models/directoryTerminology";

/**
 * Responsive wrapper around the two "create" actions.
 *
 * Desktop: renders the stacked FABs via `FabSlot` exactly as before.
 * Mobile: renders nothing in the canvas and instead registers the same
 * actions with `useMobileActionsStore`, so `MobileBottomBar` can show
 * them as compact icon buttons.
 */
export const CreateActions: React.FC<CreateFabProps> = ({
  onCreateNote,
  onCreateDirectory,
  directoryKind = "chapter",
}) => {
  const { isMobile } = useBreakpoint();
  const ownerId = useId();
  const setActions = useMobileActionsStore((s) => s.setActions);
  const clearActions = useMobileActionsStore((s) => s.clearActions);

  // Keep the latest handlers in a ref so the registration effect does
  // not re-run (and churn the bottom bar) every time an inline callback
  // changes identity on the page's render.
  const handlersRef = useRef({ onCreateNote, onCreateDirectory });
  useEffect(() => {
    handlersRef.current = { onCreateNote, onCreateDirectory };
  }, [onCreateNote, onCreateDirectory]);
  const hasDirectoryAction = onCreateDirectory !== undefined;

  useEffect(() => {
    if (!isMobile) {
      clearActions(ownerId);
      return;
    }
    const actions: MobileAction[] = [
      {
        id: `${ownerId}-note`,
        label: "New note",
        icon: <NoteAddIcon />,
        onClick: () => handlersRef.current.onCreateNote(),
      },
    ];
    if (hasDirectoryAction) {
      actions.push({
        id: `${ownerId}-directory`,
        label: `New ${directoryTerms(directoryKind).singularLower}`,
        icon: <CreateNewFolderIcon />,
        onClick: () => handlersRef.current.onCreateDirectory?.(),
      });
    }
    setActions(ownerId, actions);
    return () => clearActions(ownerId);
  }, [
    isMobile,
    ownerId,
    hasDirectoryAction,
    directoryKind,
    setActions,
    clearActions,
  ]);

  if (isMobile) {
    return null;
  }

  return (
    <FabSlot>
      <CreateFab
        onCreateNote={onCreateNote}
        onCreateDirectory={onCreateDirectory}
        directoryKind={directoryKind}
      />
    </FabSlot>
  );
};

export default CreateActions;
