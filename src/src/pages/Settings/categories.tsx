import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import type { SettingsCategory } from "./types";
import { BookstackImportSection } from "./BookstackImportSection";

/**
 * Ordered list of categories rendered in the Settings page's left rail.
 *
 * Add new categories here; both the left rail and the right-column
 * body read this list, so a new entry shows up in both places
 * automatically.
 *
 * The first entry is BookStack import per the original ask; later
 * entries (look-and-feel, account, etc.) can be appended below.
 */
export const settingsCategories: SettingsCategory[] = [
  {
    id: "bookstack-import",
    label: "BookStack Import",
    icon: <CloudUploadIcon />,
    settingsContent: <BookstackImportSection />,
  },
];
