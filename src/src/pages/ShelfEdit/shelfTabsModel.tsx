import type { ReactElement } from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import RuleFolderIcon from "@mui/icons-material/RuleFolder";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

export type ShelfTab = "settings" | "rules" | "permissions";

export interface ShelfTabOption {
  value: ShelfTab;
  label: string;
  icon: ReactElement;
}

/** Tabs offered by the shelf page, in render order. */
export const SHELF_TABS: readonly ShelfTabOption[] = [
  {
    value: "settings",
    label: "Settings",
    icon: <SettingsIcon fontSize="small" />,
  },
  {
    value: "rules",
    label: "Rules",
    icon: <RuleFolderIcon fontSize="small" />,
  },
  {
    value: "permissions",
    label: "Permissions",
    icon: <AdminPanelSettingsIcon fontSize="small" />,
  },
];

export function isShelfTab(value: string | null): value is ShelfTab {
  return value !== null && SHELF_TABS.some((tab) => tab.value === value);
}
