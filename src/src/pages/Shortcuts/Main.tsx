import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import { M2, M3, M4 } from "../../statics";
import { ShortcutsList } from "./ShortcutsList";

/**
 * Reference page for every registered keyboard shortcut, grouped by the
 * page it applies to and annotated with the key combination and the
 * state required for it to be active.
 *
 * Driven entirely by `config/shortcuts.json`, so adding an entry there
 * makes it show up here (and in the Ctrl+/ modal) without touching this
 * component.
 */
export const ShortcutsPage: React.FC = () => {
  return (
    <Box sx={{ maxWidth: "56rem", mx: "auto", p: M4, width: "100%" }}>
      <Stack spacing={M3}>
        <Stack direction="row" spacing={M2} sx={{ alignItems: "center" }}>
          <KeyboardIcon />
          <Typography variant="h5">Keyboard shortcuts</Typography>
        </Stack>

        <ShortcutsList />
      </Stack>
    </Box>
  );
};

export default ShortcutsPage;
