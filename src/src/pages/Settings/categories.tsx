import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import type { SettingsCategory } from "./types";
import { BookstackImportSection } from "./BookstackImportSection";
import { CacheSection } from "./CacheSection";

/**
 * Add new categories here; both the left rail and the right-column
 * body read this list, so a new entry shows up in both places
 * automatically.
 */
export const settingsCategories: SettingsCategory[] = [
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
];
