import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useImageBlobCacheStore } from "./useImageBlobCache";
import { PERSIST_KEYS } from "../statics";

// Metadata in localStorage; bytes in IndexedDB via the blob cache.
export interface BackgroundImageEntry {
  // Stable id; React key.
  id: string;
  // Source URL the user picked (also the blob cache key).
  src: string;
  // Display name shown in the library UI.
  name: string;
}

interface BackgroundImageLibraryState {
  entries: BackgroundImageEntry[];
  addEntry: (entry: BackgroundImageEntry) => void;
  removeEntry: (id: string) => void;
  renameEntry: (id: string, name: string) => void;
  // Remove the blob bytes for the given src from IndexedDB.
  // Library entry removal and blob removal are separate concerns;
  // the caller picks which to run.
  removeBlob: (src: string) => Promise<void>;
}

const isEntryArray = (value: unknown): value is BackgroundImageEntry[] =>
  Array.isArray(value) &&
  value.every(
    (v) =>
      v !== null &&
      typeof v === "object" &&
      typeof (v as BackgroundImageEntry).id === "string" &&
      typeof (v as BackgroundImageEntry).src === "string" &&
      typeof (v as BackgroundImageEntry).name === "string",
  );

export const useBackgroundImageLibraryStore =
  create<BackgroundImageLibraryState>()(
    persist(
      (set) => ({
        entries: [],

        addEntry: (entry) => set((s) => ({ entries: [...s.entries, entry] })),

        removeEntry: (id) =>
          set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

        renameEntry: (id, name) =>
          set((s) => ({
            entries: s.entries.map((e) => (e.id === id ? { ...e, name } : e)),
          })),

        removeBlob: async (src) => {
          await useImageBlobCacheStore.getState().remove(src);
        },
      }),
      {
        name: PERSIST_KEYS.backgroundImageLibrary,
        storage: createJSONStorage(() => localStorage),
        version: 2,
        partialize: (state) => ({ entries: state.entries }),
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as Partial<BackgroundImageLibraryState>;
          return {
            ...current,
            entries: isEntryArray(p.entries) ? p.entries : [],
          };
        },
      },
    ),
  );
