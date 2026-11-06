import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import { PanelSection } from "../../../components/Panels/PanelSection";
import { KeyboardShortcut } from "../../../utils/renderShortcut";
import { useEditorModeShortcuts } from "./useEditorModeShortcuts";

/**
 * Right-rail reference for the editor's hold-to-run shortcuts. Rows
 * whose action does not apply to the current editor state are dimmed,
 * so the panel doubles as a mode indicator.
 */
export const EditorShortcutsPanel: React.FC = () => {
  const { shortcuts } = useEditorModeShortcuts();

  return (
    <PanelSection
      title="Shortcuts"
      titleIcon={<KeyboardIcon fontSize="small" />}
      bordered
    >
      <Stack spacing={1}>
        {shortcuts.map((shortcut) => (
          <Box
            key={`${shortcut.key}-${shortcut.label}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              opacity: shortcut.available ? 1 : 0.4,
            }}
          >
            <KeyboardShortcut shortcut={shortcut.keyLabel ?? shortcut.key} />
            <Typography variant="caption" color="text.secondary">
              long
            </Typography>
            <Typography variant="body2" sx={{ ml: "auto", textAlign: "right" }}>
              {shortcut.label}
            </Typography>
          </Box>
        ))}
      </Stack>
    </PanelSection>
  );
};

export default EditorShortcutsPanel;
