import { Box, Stack, Typography } from "@mui/material";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import { PanelSection } from "../../components/Panels/PanelSection";
import { KeyboardShortcut } from "../../utils/renderShortcut";
import {
  describeShortcutState,
  isComboShortcut,
  matchesShortcutState,
  shortcutConfig,
  shortcutDisplayKey,
  type ShortcutPageConfig,
  type ShortcutState,
} from "../../config/shortcuts";

export interface ShortcutsListProps {
  /**
   * Page ids to render, in order. When omitted every catalogue page is
   * shown.
   */
  pageIds?: string[];
  /**
   * When provided, only shortcuts whose `when` conditions match this
   * state are rendered. Omitted means every shortcut on the listed pages
   * is shown.
   */
  state?: ShortcutState;
}

/**
 * The keyboard-shortcut reference, grouped by page. Shared by the
 * `/shortcuts` page (all pages) and the Ctrl+/ modal (relevant pages by
 * default, all pages on demand) so both stay in sync with
 * `config/shortcuts.json`.
 *
 * Combo (tap) shortcuts are rendered without the "long" annotation,
 * sitting next to the long-press actions.
 */
export const ShortcutsList: React.FC<ShortcutsListProps> = ({
  pageIds,
  state,
}) => {
  const pages: Array<[string, ShortcutPageConfig]> = pageIds
    ? pageIds.flatMap((id) => {
        const page = shortcutConfig[id];
        return page ? [[id, page] as const] : [];
      })
    : Object.entries(shortcutConfig);

  return (
    <Stack spacing={2}>
      {pages.map(([pageId, page]) => {
        const shortcuts = state
          ? page.shortcuts.filter((shortcut) =>
              matchesShortcutState(shortcut.when, state),
            )
          : page.shortcuts;
        if (shortcuts.length === 0) return null;

        return (
          <PanelSection
            key={pageId}
            title={page.label}
            titleIcon={<KeyboardIcon fontSize="small" />}
            bordered
          >
            <Stack spacing={1.5}>
              {shortcuts.map((shortcut) => (
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
        );
      })}
    </Stack>
  );
};

export default ShortcutsList;
