import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PaletteIcon from "@mui/icons-material/Palette";
import type { SettingsCategory } from "./types";
import { BookstackImportSection } from "./BookstackImportSection";
import { CacheSection } from "./CacheSection";
import { AdministrationSection } from "./AdministrationSection";
import { AppearanceSection } from "./AppearanceSection";
import { useAppearanceSettings } from "../../zustand/useAppearanceSettings";

/**
 * Add new categories here; both the left rail and the right-column
 * body read this list, so a new entry shows up in both places
 * automatically.
 */
export const settingsCategories: SettingsCategory[] = [
  {
    id: "administration",
    label: "Administration",
    icon: <AdminPanelSettingsIcon />,
    settingsContent: <AdministrationSection />,
  },
  {
    id: "bookstack-import",
    label: "BookStack Import",
    icon: <CloudUploadIcon />,
    settingsContent: <BookstackImportSection />,
  },
  {
    id: "cache",
    label: "Cache",
    icon: <DeleteSweepIcon />,
    settingsContent: <CacheSection />,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: <PaletteIcon />,
    settingsContent: <AppearanceSection />,
    resetLogic: () => {
      const { setCodeBlockThemeLight, setCodeBlockThemeDark } =
        useAppearanceSettings.getState();
      setCodeBlockThemeLight("tokyo-night-light");
      setCodeBlockThemeDark("material-palenight");
    },
  },
];
