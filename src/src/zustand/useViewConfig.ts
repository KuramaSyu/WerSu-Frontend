import { create } from "zustand";
import type { ViewConfig } from "../api/models/ViewConfig";

/**
 * Default `ViewConfig` for the private note editor (and any editor that
 * doesn't explicitly opt into a different config). Keeps the affordances
 * available to logged-in users untouched.
 */
const DEFAULT_VIEW_CONFIG: ViewConfig = {
  readOnly: false,
};

interface ViewConfigState {
  config: ViewConfig;

  /**
   * Shallow-merge partial flags into the current config. Used by the
   * public-note page on mount to flip `readOnly` based on the share's
   * granted permission.
   */
  setViewConfig: (cfg: Partial<ViewConfig>) => void;

  /**
   * Reset to `DEFAULT_VIEW_CONFIG`. Called on unmount of the public-note
   * page so navigating back to `/n/*` doesn't pick up stale flags.
   */
  resetViewConfig: () => void;
}

export const useViewConfig = create<ViewConfigState>((set) => ({
  config: DEFAULT_VIEW_CONFIG,
  setViewConfig: (cfg) =>
    set((state) => ({ config: { ...state.config, ...cfg } })),
  resetViewConfig: () => set({ config: DEFAULT_VIEW_CONFIG }),
}));
