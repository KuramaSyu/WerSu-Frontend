import { create } from "zustand";

interface EditorSettingsState {
  /** true when edit mode is enabled */
  editMode: boolean;
  setWrite: (write_enabled: boolean) => void;
  viewMode: "source" | "rich";
  setViewMode: (mode: "source" | "rich") => void;
}

export const useEditorSettings = create<EditorSettingsState>((set) => ({
  editMode: false,
  setWrite: (write_enabled: boolean) => set({ editMode: write_enabled }),
  viewMode: "rich",
  setViewMode: (mode: "source" | "rich") => set({ viewMode: mode }),
}));
