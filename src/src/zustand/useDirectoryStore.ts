import { create } from "zustand";
import type { DirectoryReply } from "../api/models/directory";
import type { MinimalDirectory } from "../api/models/search";

interface DirectoryState {
  // Mapping directory ID -> Directory instance.
  directoriesById: Record<string, DirectoryReply>;
  setDirectories: (directories: DirectoryReply[]) => void;
  upsertDirectory: (directory: DirectoryReply) => void;
  /**
   * Inserts (or refreshes) a directory by `MinimalDirectory` payload.
   *
   * The backend returns a `MinimalDirectory` shape from search /
   * `GET /api/directories/:id/notes`. We can't construct a full
   * `DirectoryReply` from it (no parent ids, no description, ...), so
   * this stores the minimum and merges it into the lookup map without
   * dropping previously-fetched fields.
   */
  upsertMinimalDirectory: (directory: MinimalDirectory) => void;
  removeDirectory: (id: string) => void;
  clearDirectories: () => void;
}

const mapDirectoriesById = (
  directories: DirectoryReply[],
): Record<string, DirectoryReply> => {
  const byId: Record<string, DirectoryReply> = {};
  directories.forEach((directory) => {
    byId[directory.id] = directory;
  });
  return byId;
};

export const useDirectoryStore = create<DirectoryState>((set) => ({
  directoriesById: {},
  setDirectories: (directories: DirectoryReply[]) =>
    set({ directoriesById: mapDirectoriesById(directories) }),
  upsertDirectory: (directory: DirectoryReply) =>
    set((state) => ({
      directoriesById: {
        ...state.directoriesById,
        [directory.id]: directory,
      },
    })),
  upsertMinimalDirectory: (directory: MinimalDirectory) =>
    set((state) => {
      const existing = state.directoriesById[directory.id];
      if (existing) {
        // Preserve parent/children metadata we may already know about.
        return {
          directoriesById: {
            ...state.directoriesById,
            [directory.id]: {
              ...existing,
              display_name: directory.display_name ?? existing.display_name,
              name: directory.slug ?? existing.name,
            },
          },
        };
      }
      return {
        directoriesById: {
          ...state.directoriesById,
          [directory.id]: {
            id: directory.id,
            display_name: directory.display_name,
            name: directory.slug,
            parent_dir_ids: [],
            child_dir_ids: [],
            child_note_ids: [],
          },
        },
      };
    }),
  removeDirectory: (id: string) =>
    set((state) => {
      const directoriesById = { ...state.directoriesById };
      delete directoriesById[id];
      return { directoriesById };
    }),
  clearDirectories: () => set({ directoriesById: {} }),
}));
