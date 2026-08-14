import { create } from "zustand";

/**
 * Tracks whether the global Ctrl/Cmd modifier is currently held.
 *
 * A single shared store drives every `ShortcutTooltip` in the app,
 * so a `useGlobalModifier` listener mounted at boot can flip the
 * flag once and all the registered tooltips react together.
 *
 * `setModifierPressed` is exposed (rather than letting callers
 * call `set` directly) so the store surface stays small and the
 * "what counts as the modifier" decision (Ctrl, Meta, or both)
 * lives entirely in `useGlobalModifier`.
 */
interface ShortcutModifierState {
  isModifierPressed: boolean;
  setModifierPressed: (pressed: boolean) => void;
}

export const useShortcutModifierStore = create<ShortcutModifierState>(
  (set) => ({
    isModifierPressed: false,
    setModifierPressed: (pressed) => set({ isModifierPressed: pressed }),
  }),
);
