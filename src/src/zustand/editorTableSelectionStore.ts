// Editor table-selection store.
//
// Published view of the editor's current table selection, used by
// the bubble menu's strategy picker. Lives in its own zustand
// store so the bubble menu can subscribe to a single value and
// re-render only when the active table context changes -- not on
// every keystroke.
//
// The store is write-only from the bridge's perspective:
// `setSelection` is called on every selectionUpdate (the bridge
// computes the analysis once and pushes the relevant fields).
// Components never mutate it; they only subscribe.

import { create } from "zustand";

/** What the bubble menu needs to know about the current table
 *  selection. All fields are reset to the empty defaults on a
 *  non-table selection -- the bubble menu treats that as
 *  "no in-table context" and falls through to the text
 *  strategy. */
export interface EditorTableSelectionState {
  /** True when the selection spans one or more full table rows. */
  isFullRow: boolean;
  /** True when the selection spans one or more full table columns. */
  isFullColumn: boolean;
  /** True when the selection spans multiple tables (or no
   *  table at all). The bubble menu ignores the in-table
   *  strategies in this case. */
  isMultiTable: boolean;
  /** Sorted unique row indices covered by the selection. */
  rowIndices: readonly number[];
  /** Sorted unique column indices covered by the selection. */
  columnIndices: readonly number[];
  /** Set the current table-selection summary. Pass a partial to
   *  patch, or omit a field to leave it untouched. `reset`
   *  clears everything. */
  setSelection: (next: Partial<EditorTableSelectionState>) => void;
  reset: () => void;
}

const EMPTY: Pick<
  EditorTableSelectionState,
  "isFullRow" | "isFullColumn" | "isMultiTable" | "rowIndices" | "columnIndices"
> = {
  isFullRow: false,
  isFullColumn: false,
  isMultiTable: false,
  rowIndices: [],
  columnIndices: [],
};

export const useEditorTableSelectionStore = create<EditorTableSelectionState>(
  (set) => ({
    ...EMPTY,
    setSelection: (next) => set(next),
    reset: () => set({ ...EMPTY }),
  }),
);
