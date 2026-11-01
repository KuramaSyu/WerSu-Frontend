import { create } from "zustand";

/**
 * Tracks the row currently focused by keyboard type-ahead in the
 * directory view.
 *
 * This is deliberately separate from `useDirectorySelectionStore`:
 * multi-select marks rows for bulk actions, while type-ahead only
 * moves a transient "cursor" to the row the user is jumping to. The
 * stored value is the row's `${kind}:${id}` key, matching the
 * `data-directory-nav` attribute rendered on each selectable row.
 */
interface DirectoryTypeAheadState {
  /** Key of the highlighted row, or `null` when nothing is highlighted. */
  highlighted: string | null;
  /** Highlight the row with the given key. */
  setHighlighted: (key: string) => void;
  /** Drop the highlight. */
  clear: () => void;
}

export const useDirectoryTypeAheadStore = create<DirectoryTypeAheadState>(
  (set) => ({
    highlighted: null,
    setHighlighted: (key) => set({ highlighted: key }),
    clear: () => set({ highlighted: null }),
  }),
);
