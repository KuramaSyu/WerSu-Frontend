import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import { M2, M3, M4 } from "../../statics";
import { PanelSection } from "../../components/Panels/PanelSection";
import { KeyboardShortcut } from "../../utils/renderShortcut";
import { describeShortcutState, shortcutConfig } from "../../config/shortcuts";

/**
 * Reference page for every registered keyboard shortcut, grouped by the
 * page it applies to and annotated with the key combination and the
 * state required for it to be active.
 *
 * Driven entirely by `config/shortcuts.json`, so adding an entry there
 * makes it show up here without touching this component.
 */
export const ShortcutsPage: React.FC = () => {
  const pages = Object.entries(shortcutConfig);

  return (
    <Box sx={{ maxWidth: "56rem", mx: "auto", p: M4, width: "100%" }}>
      <Stack spacing={M3}>
        <Stack direction="row" spacing={M2} sx={{ alignItems: "center" }}>
          <KeyboardIcon />
          <Typography variant="h5">Keyboard shortcuts</Typography>
        </Stack>

        {pages.map(([pageId, page]) => (
          <PanelSection
            key={pageId}
            title={page.label}
            titleIcon={<KeyboardIcon fontSize="small" />}
            bordered
          >
            <Stack spacing={1.5}>
              {page.shortcuts.map((shortcut) => (
                <Box
                  key={shortcut.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <KeyboardShortcut
                    shortcut={shortcut.keyLabel ?? shortcut.key}
                  />
                  {shortcut.hold !== false && (
                    <Typography variant="caption" color="text.secondary">
                      long
                    </Typography>
                  )}
                  <Typography variant="body2">{shortcut.label}</Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: "auto" }}
                  >
                    {describeShortcutState(shortcut.when)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </PanelSection>
        ))}
      </Stack>
    </Box>
  );
};

export default ShortcutsPage;
