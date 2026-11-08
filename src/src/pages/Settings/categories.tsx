import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CodeIcon from "@mui/icons-material/Code";
import LockIcon from "@mui/icons-material/Lock";
import PaletteIcon from "@mui/icons-material/Palette";
import SearchIcon from "@mui/icons-material/Search";
import WifiIcon from "@mui/icons-material/Wifi";
import type { SettingsCategory } from "./types";
import { BookstackImportSection } from "./BookstackImportSection";
import { ThemeGeneratorSection } from "./ThemeGeneratorSection";
import { CacheSection } from "./CacheSection";
import { AdministrationSection } from "./AdministrationSection";
import { AppearanceSection } from "./AppearanceSection";
import { NetworkSection } from "./NetworkSection";
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
    description: "Backend reachability and service health.",
    icon: <AdminPanelSettingsIcon />,
    settingsContent: <AdministrationSection />,
  },
  {
    id: "theme-generator",
    label: "Theme generator",
    description: "Generate light and dark themes from an image.",
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
    description: "Import BookStack book exports as directory trees.",
    icon: <CloudUploadIcon />,
    settingsContent: <BookstackImportSection />,
  },
  {
    id: "cache",
    label: "Cache",
    description: "Clear locally cached query data.",
    icon: <DeleteSweepIcon />,
    settingsContent: <CacheSection />,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Control the look of the app and the note editor.",
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
    id: "network",
    label: "Network",
    description: "Connection hints and performance mode.",
    icon: <WifiIcon />,
    settingsContent: <NetworkSection />,
    resetLogic: () => {
      useFeatureStore.getState().setPerformanceMode(false);
    },
  },
  {
    id: "developer",
    label: "Developer",
    description: "Debug tools and raw preference access.",
    icon: <CodeIcon />,
    settingsContent: <DeveloperSection />,
  },
  {
    id: "search",
    label: "Search",
    description: "Choose the search mode used by default.",
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
    description: "Manage sign-in methods and account details.",
    icon: <LockIcon />,
    settingsContent: <SecuritySection />,
  },
];
