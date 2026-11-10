import { Box, Stack, Tab, Tabs } from "@mui/material";
import type { ShelfReply } from "../../api/models/shelf";
import { ShelfSettingsTab } from "./ShelfSettingsTab";
import { ShelfPermissionsTab } from "./ShelfPermissionsTab";
import { ShelfRulesManager } from "../Rules/ShelfRulesManager";
import { SHELF_TABS, type ShelfTab } from "./shelfTabsModel";

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
  return (
    // Single fluid width shared by all three tab bodies (Settings / Rules
    // / Permissions) so they line up. `clamp` keeps it readable on small
    // screens and stops forms from stretching on large ones.
    <Stack
      spacing={3}
      sx={{ width: "100%", maxWidth: "clamp(20rem, 100%, 48rem)" }}
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
