import { Box, Stack, Tab, Tabs } from "@mui/material";
import type { ShelfReply } from "../../api/models/shelf";
import { ShelfSettingsTab } from "./ShelfSettingsTab";
import { ShelfPermissionsTab } from "./ShelfPermissionsTab";
import { ShelfRulesManager } from "../Rules/ShelfRulesManager";
import { SHELF_TABS, type ShelfTab } from "./shelfTabsModel";
import { SHELF_WIDTH_STATES } from "./shelfWidthMode";
import { useShelfWidthMode } from "./useShelfWidthMode";

export interface ShelfTabsProps {
  shelf: ShelfReply;
  activeTab: ShelfTab;
  onTabChange: (tab: ShelfTab) => void;
}

/**
 * Main-object tabs for a shelf: Settings, Rules and Permissions.
 *
 * The tab body replaces the former per-task routes and left-rail
 * buttons, so everything about a shelf lives on one page.
 */
export const ShelfTabs: React.FC<ShelfTabsProps> = ({
  shelf,
  activeTab,
  onTabChange,
}) => {
  // User-chosen width, cycled from the top bar. One fluid width is
  // shared by all three tab bodies (Settings / Rules / Permissions) so
  // they always line up; `clamp` keeps forms readable on small screens
  // and stops them stretching on large ones under `normal`/`wide`.
  const widthMode = useShelfWidthMode((s) => s.widthMode);
  const widthState =
    SHELF_WIDTH_STATES[widthMode] ?? SHELF_WIDTH_STATES.normal;

  return (
    <Stack
      spacing={3}
      sx={{
        width: "100%",
        maxWidth: widthState.contentWidth,
        // Ease between presets instead of snapping. `max-width` is a
        // length in every preset, so the browser can interpolate it.
        transition: (t) =>
          t.transitions.create("max-width", {
            duration: t.transitions.duration.standard,
            easing: t.transitions.easing.easeInOut,
          }),
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
        },
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={activeTab}
          onChange={(_, value: ShelfTab) => onTabChange(value)}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          {SHELF_TABS.map(({ value, label, icon }) => (
            <Tab
              key={value}
              value={value}
              label={label}
              icon={icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Box>

      {activeTab === "settings" ? (
        <ShelfSettingsTab key={shelf.id} shelf={shelf} />
      ) : null}
      {activeTab === "rules" ? <ShelfRulesManager shelfId={shelf.id} /> : null}
      {activeTab === "permissions" ? (
        <ShelfPermissionsTab shelfId={shelf.id} />
      ) : null}
    </Stack>
  );
};

export default ShelfTabs;
