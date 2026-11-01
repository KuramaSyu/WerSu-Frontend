import React, { useMemo, useState } from "react";
import { Box, Button } from "@mui/material";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import { useLocation } from "react-router-dom";
import { ModalShell } from "../../components/ModalShell";
import { getRelevantShortcutPageIds } from "../../config/shortcuts";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useViewConfig } from "../../zustand/useViewConfig";
import { ShortcutsList } from "./ShortcutsList";

export interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal listing keyboard shortcuts, opened by Ctrl+/ from anywhere in
 * the app (see `GlobalShortcuts`).
 *
 * By default it shows only the shortcuts relevant where the user is:
 * the active page, matching the current editor state, plus the global
 * ones. A "Show all" button reveals the full catalogue.
 */
export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  open,
  onClose,
}) => {
  const { pathname } = useLocation();
  const [showAll, setShowAll] = useState(false);
  const viewMode = useEditorSettings((s) => s.viewMode);
  const editMode = useEditorSettings((s) => s.editMode);
  const readOnly = useViewConfig((s) => s.config.readOnly);

  const relevantPageIds = useMemo(
    () => getRelevantShortcutPageIds(pathname),
    [pathname],
  );
  const editorState = useMemo(
    () => ({ viewMode, editMode, readOnly }),
    [viewMode, editMode, readOnly],
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={<KeyboardIcon />}
      title="Keyboard shortcuts"
      subtitle="Hold long actions; tap the rest"
      maxWidth="sm"
      minHeight="auto"
      actions={
        <Button size="small" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Show relevant only" : "Show all"}
        </Button>
      }
    >
      <Box sx={{ maxHeight: "60vh", overflowY: "auto", pr: 0.5 }}>
        <ShortcutsList
          pageIds={showAll ? undefined : relevantPageIds}
          state={showAll ? undefined : editorState}
        />
      </Box>
    </ModalShell>
  );
};

export default ShortcutsModal;
