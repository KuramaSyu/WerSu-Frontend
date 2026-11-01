import { Box, Stack, Typography } from "@mui/material";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import { PanelSection } from "../../components/Panels/PanelSection";
import { KeyboardShortcut } from "../../utils/renderShortcut";
import {
  describeShortcutState,
  isComboShortcut,
  shortcutConfig,
  shortcutDisplayKey,
} from "../../config/shortcuts";

/**
 * The full keyboard-shortcut reference, grouped by page. Shared by the
 * `/shortcuts` page and the Ctrl+/ modal so both stay in sync with
 * `config/shortcuts.json`.
 *
 * Combo (tap) shortcuts are rendered without the "long" annotation,
 * sitting next to the long-press actions.
 */
export const ShortcutsList: React.FC = () => {
  const pages = Object.entries(shortcutConfig);

  return (
    <Stack spacing={2}>
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
                <KeyboardShortcut shortcut={shortcutDisplayKey(shortcut)} />
                {!isComboShortcut(shortcut) && shortcut.hold !== false && (
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
  );
};

export default ShortcutsList;
