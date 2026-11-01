import React from "react";
import { Box } from "@mui/material";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import { ModalShell } from "../../components/ModalShell";
import { ShortcutsList } from "./ShortcutsList";

export interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal listing every keyboard shortcut. Opened by Ctrl+/ from
 * anywhere in the app (see `GlobalShortcuts`), so the reference is
 * reachable without leaving the current page.
 */
export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  open,
  onClose,
}) => {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={<KeyboardIcon />}
      title="Keyboard shortcuts"
      subtitle="Hold long actions; tap the rest"
      maxWidth="sm"
      minHeight="auto"
    >
      <Box sx={{ maxHeight: "60vh", overflowY: "auto", pr: 0.5 }}>
        <ShortcutsList />
      </Box>
    </ModalShell>
  );
};

export default ShortcutsModal;
