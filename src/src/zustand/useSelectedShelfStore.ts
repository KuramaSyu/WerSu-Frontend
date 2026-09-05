import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Holds the shelf the user picked from the top bar's shelf menu.
 *
 * Lives independently of the `useShelves` query cache so consumers
 * can subscribe to "the current shelf" without re-running on every
 * shelf-list refresh.
 *
 * Persisted to `localStorage` under `selected-shelf-storage` so the
 * pick survives a page reload. On boot every request can read the
 * id via `useSelectedShelfStore.getState().selectedShelfId` and
 * scope its query (e.g. `include_shelf_ids` on `/api/notes/search`).
 *
 * `selectedShelfId === null` means "no shelf selected" -- the menu
 * falls back to a placeholder label and shelf-scoped routes should
 * treat it as "all shelves".
 */

const STORAGE_KEY = "selected-shelf-storage";
const STORAGE_VERSION = 1;

interface SelectedShelfState {
  selectedShelfId: string | null;
  setSelectedShelfId: (id: string | null) => void;
}

export const useSelectedShelfStore = create<SelectedShelfState>()(
  persist(
    (set) => ({
      selectedShelfId: null,
      setSelectedShelfId: (id) => set({ selectedShelfId: id }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      // Persist only the id; actions are pure helpers.
      partialize: (state) => ({ selectedShelfId: state.selectedShelfId }),
    },
  ),
);
