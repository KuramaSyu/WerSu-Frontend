import { create } from "zustand";

interface EditorSettingsState {
  write: boolean;
  setWrite: (write_enabled: boolean) => void;
  viewMode: "source" | "rich";
}

export const useEditorSettings = create<EditorSettingsState>((set) => ({
  write: false,
  setWrite: (write_enabled: boolean) => set({ write: write_enabled }),
  viewMode: "rich",
}));
