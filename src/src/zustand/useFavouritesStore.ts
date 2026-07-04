import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Persistent user-facing favourites (notes + directories).
 *
 * Stored in `localStorage` under `favourites-storage` via the
 * `persist` middleware; the per-kind `Record<string, true>` shape
 * gives O(1) membership checks and serializes cleanly as JSON. Store
 * labels on the entities themselves, not in here, so a renamed
 * favourite still resolves to the latest title once data is refetched.
 */

const STORAGE_KEY = "favourites-storage";
const STORAGE_VERSION = 1;

export interface FavouritesState {
  /** Note IDs the user has marked as favourite. */
  notes: Record<string, true>;
  /** Directory IDs the user has marked as favourite. */
  directories: Record<string, true>;
  /** Flip a note's favourite status. Returns the new status. */
  toggleNote: (id: string) => boolean;
  /** Flip a directory's favourite status. Returns the new status. */
  toggleDirectory: (id: string) => boolean;
  /** Force a note favourite to the given state (idempotent). */
  setNoteFavourite: (id: string, favourite: boolean) => void;
  /** Force a directory favourite to the given state (idempotent). */
  setDirectoryFavourite: (id: string, favourite: boolean) => void;
  /** Drop every favourite (notes + directories). */
  clear: () => void;
}

const add = (record: Record<string, true>, id: string) => {
  // Spread rather than mutate so React/Zustand subscribers see a new
  // reference and re-render.
  return { ...record, [id]: true as const };
};

const remove = (record: Record<string, true>, id: string) => {
  if (!(id in record)) {
    return record;
  }
  const next = { ...record };
  delete next[id];
  return next;
};

export const useFavouritesStore = create<FavouritesState>()(
  persist(
    (set, get) => ({
      notes: {},
      directories: {},
      toggleNote: (id) => {
        const isFavourite = Boolean(get().notes[id]);
        set((state) => ({
          notes: isFavourite ? remove(state.notes, id) : add(state.notes, id),
        }));
        return !isFavourite;
      },
      toggleDirectory: (id) => {
        const isFavourite = Boolean(get().directories[id]);
        set((state) => ({
          directories: isFavourite
            ? remove(state.directories, id)
            : add(state.directories, id),
        }));
        return !isFavourite;
      },
      setNoteFavourite: (id, favourite) =>
        set((state) => {
          const currentlyFavourite = Boolean(state.notes[id]);
          if (currentlyFavourite === favourite) {
            return state;
          }
          return {
            notes: favourite ? add(state.notes, id) : remove(state.notes, id),
          };
        }),
      setDirectoryFavourite: (id, favourite) =>
        set((state) => {
          const currentlyFavourite = Boolean(state.directories[id]);
          if (currentlyFavourite === favourite) {
            return state;
          }
          return {
            directories: favourite
              ? add(state.directories, id)
              : remove(state.directories, id),
          };
        }),
      clear: () => set({ notes: {}, directories: {} }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      // Persist only the data; actions are pure helpers that don't
      // belong in storage.
      partialize: (state) => ({
        notes: state.notes,
        directories: state.directories,
      }),
    },
  ),
);
