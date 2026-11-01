import { create } from "zustand";
import type { ViewConfig } from "../api/models/ViewConfig";

/**
 * Default `ViewConfig` for the private note editor (and any editor that
 * doesn't explicitly opt into a different config). Keeps the affordances
 * available to logged-in users untouched.
 */
const DEFAULT_VIEW_CONFIG: ViewConfig = {
  readOnly: false,
  widthMode: "normal",
};

/**
 * Panel layout captured just before entering a width mode that manages
 * panels (`full`). Stored here — rather than in a per-hook ref — so the
 * top-bar width toggle and the editor's width shortcuts (which live in
 * different components) share one transition history. See
 * `useNoteWidthMode`.
 */
export interface NotePanelSnapshot {
  leftOpen: boolean;
  rightOpen: boolean;
  leftOverride: boolean;
  rightOverride: boolean;
}

interface ViewConfigState {
  config: ViewConfig;

  /**
   * Layout to restore once the active mode stops forcing panels, or
   * `null` when no panel-managing mode is in flight. Transition
   * history, not configuration — kept out of `config` so it is never
   * mistaken for a user preference.
   */
  panelSnapshot: NotePanelSnapshot | null;

  setPanelSnapshot: (snapshot: NotePanelSnapshot | null) => void;

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
  panelSnapshot: null,
  setViewConfig: (cfg) =>
    set((state) => ({ config: { ...state.config, ...cfg } })),
  setPanelSnapshot: (panelSnapshot) => set({ panelSnapshot }),
  resetViewConfig: () =>
    set({ config: DEFAULT_VIEW_CONFIG, panelSnapshot: null }),
}));
