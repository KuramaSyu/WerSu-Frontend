import { create } from "zustand";

/** Discriminates the two selectable item kinds in the directory view. */
export type SelectionKind = "directory" | "note";

export interface SelectionEntry {
  kind: SelectionKind;
  id: string;
}

interface DirectorySelectionState {
  /** Map keyed by `${kind}:${id}` for fast lookup + duplicate prevention. */
  selected: Record<string, SelectionEntry>;
  /** True once the user has long-pressed (or otherwise entered select mode). */
  active: boolean;
  /** Begin a new selection rooted at the given entry. */
  startSelection: (entry: SelectionEntry) => void;
  /** Toggle an entry in/out of the selection. */
  toggle: (entry: SelectionEntry) => void;
  /** Replace the selection with the given list. */
  setMany: (entries: SelectionEntry[]) => void;
  /** Add every entry to the selection. */
  selectAll: (entries: SelectionEntry[]) => void;
  /** Drop everything; also exits select mode. */
  clear: () => void;
  /** Exit select mode without dropping the selection. */
  exitSelectMode: () => void;
}

const keyOf = (entry: SelectionEntry): string => `${entry.kind}:${entry.id}`;

export const useDirectorySelectionStore = create<DirectorySelectionState>(
  (set) => ({
    selected: {},
    active: false,
    startSelection: (entry) =>
      set(() => ({
        active: true,
        selected: { [keyOf(entry)]: entry },
      })),
    toggle: (entry) =>
      set((state) => {
        const k = keyOf(entry);
        const next = { ...state.selected };
        if (next[k]) {
          delete next[k];
        } else {
          next[k] = entry;
        }
        return { selected: next, active: state.active || true };
      }),
    setMany: (entries) =>
      set(() => {
        const next: Record<string, SelectionEntry> = {};
        for (const entry of entries) {
          next[keyOf(entry)] = entry;
        }
        return { selected: next, active: entries.length > 0 };
      }),
    selectAll: (entries) =>
      set(() => {
        const next: Record<string, SelectionEntry> = {};
        for (const entry of entries) {
          next[keyOf(entry)] = entry;
        }
        return { selected: next, active: true };
      }),
    clear: () => set({ selected: {}, active: false }),
    exitSelectMode: () => set({ active: false }),
  }),
);

export const selectionKey = keyOf;
