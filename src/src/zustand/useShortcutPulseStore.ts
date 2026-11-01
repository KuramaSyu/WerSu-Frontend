import { create } from "zustand";

/** A completed hold that should flash a confirmation pulse. */
export interface ShortcutPulse {
  /** `KeyboardEvent.key` that was held. */
  key: string;
  /** Chip label shown in the pulse. */
  keyLabel?: string;
  /** Action description shown in the pulse. */
  label: string;
  /** Monotonic id so re-triggering the same key restarts the animation. */
  id: number;
}

interface ShortcutPulseState {
  /** The pulse currently playing, or null. */
  pulse: ShortcutPulse | null;
  /** Start a pulse for a completed shortcut. */
  triggerPulse: (pulse: Omit<ShortcutPulse, "id">) => void;
  /** Clear the pulse if it is still the one identified by `id`. */
  clearPulse: (id: number) => void;
}

let nextId = 0;

/**
 * App-level confirmation pulse for hold-to-run shortcuts.
 *
 * Deliberately separate from the shortcut bar itself: the bar lives
 * inside the editor, and an action like entering/leaving insert mode can
 * remount that subtree. Rendering the pulse at the app root (via
 * `ShortcutPulse`) keeps the confirmation visible regardless.
 */
export const useShortcutPulseStore = create<ShortcutPulseState>((set) => ({
  pulse: null,
  triggerPulse: (pulse) => set({ pulse: { ...pulse, id: ++nextId } }),
  clearPulse: (id) =>
    set((state) => (state.pulse?.id === id ? { pulse: null } : state)),
}));
