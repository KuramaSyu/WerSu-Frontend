import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Holds the shelf the user picked from the top bar's shelf menu.
 *
 * Its persisted with localStorage, so that we have the last used shelf after
 * reload
 */

const STORAGE_KEY = "selected-shelf-storage";
const STORAGE_VERSION = 1;

interface SelectedShelfState {
  selectedShelfId: string | null;
  /**
   * Whether the user has made an explicit shelf choice (including
   * "All shelves"). Kept separate from `selectedShelfId` so `null` can
   * mean "All shelves" after the user picked it, instead of triggering
   * the first-load auto-select again.
   */
  hasChosenShelf: boolean;
  setSelectedShelfId: (id: string | null) => void;
}

export const useSelectedShelfStore = create<SelectedShelfState>()(
  persist(
    (set) => ({
      selectedShelfId: null,
      hasChosenShelf: false,
      setSelectedShelfId: (id) =>
        set({ selectedShelfId: id, hasChosenShelf: true }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      // Persist only the id; actions are pure helpers.
      partialize: (state) => ({
        selectedShelfId: state.selectedShelfId,
        hasChosenShelf: state.hasChosenShelf,
      }),
    },
  ),
);
