import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CodeIcon from "@mui/icons-material/Code";
import LockIcon from "@mui/icons-material/Lock";
import PaletteIcon from "@mui/icons-material/Palette";
import SearchIcon from "@mui/icons-material/Search";
import type { SettingsCategory } from "./types";
import { BookstackImportSection } from "./BookstackImportSection";
import { ThemeGeneratorSection } from "./ThemeGeneratorSection";
import { CacheSection } from "./CacheSection";
import { AdministrationSection } from "./AdministrationSection";
import { AppearanceSection } from "./AppearanceSection";
import { DeveloperSection } from "./DeveloperSection";
import { SearchSection } from "./SearchSection";
import { SecuritySection } from "./SecuritySection";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import { useAppearanceSettings } from "../../zustand/useAppearanceSettings";
import {
  SEARCH_TYPE_NO_OVERRIDE,
  useSearchSettings,
} from "../../zustand/useSearchSettings";
import { useThemeStore } from "../../zustand/useThemeStore";

/** Add new categories here; both the rail and the body read this list. */
export const settingsCategories: SettingsCategory[] = [
  {
    id: "administration",
    label: "Administration",
    icon: <AdminPanelSettingsIcon />,
    settingsContent: <AdministrationSection />,
  },
  {
    id: "theme-generator",
    label: "Theme generator",
    icon: <AutoAwesomeIcon />,
    settingsContent: <ThemeGeneratorSection />,
    resetLogic: () => {
      // Drop every saved generated theme; the store falls back to the
      // default theme if one of them was active.
      useThemeStore.getState().clearGeneratedThemes();
    },
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
      // Developer mode is part of appearance prefs; reset alongside.
      useFeatureStore.getState().setFlag(FeatureFlagName.DeveloperMode, false);
    },
  },
  {
    id: "developer",
    label: "Developer",
    icon: <CodeIcon />,
    settingsContent: <DeveloperSection />,
  },
  {
    id: "search",
    label: "Search",
    icon: <SearchIcon />,
    settingsContent: <SearchSection />,
    resetLogic: () => {
      useSearchSettings
        .getState()
        .setDefaultSearchType(SEARCH_TYPE_NO_OVERRIDE);
    },
  },
  {
    id: "security",
    label: "Security",
    icon: <LockIcon />,
    settingsContent: <SecuritySection />,
  },
];
