import { create } from "zustand";
import type { WidthMode } from "../../api/models/ViewConfig";
import { nextShelfWidthMode } from "./shelfWidthMode";

interface ShelfWidthState {
  /** Current width preset for the shelf tab body. */
  widthMode: WidthMode;
  /** Jump straight to a preset (used by tests / future shortcuts). */
  setWidthMode: (mode: WidthMode) => void;
  /** Advance `normal -> wide -> full -> normal`. */
  cycleWidthMode: () => void;
}

/**
 * View state for the shelf settings width toggle.
 *
 * Deliberately separate from the note editor's `useViewConfig`: the two
 * surfaces use different width tables, and flipping the shelf width
 * should not resize an open note (or vice versa). Not persisted, to
 * match the note toggle's session-scoped behaviour.
 */
export const useShelfWidthMode = create<ShelfWidthState>((set, get) => ({
  widthMode: "normal",
  setWidthMode: (widthMode) => set({ widthMode }),
  cycleWidthMode: () =>
    set({ widthMode: nextShelfWidthMode(get().widthMode) }),
}));
