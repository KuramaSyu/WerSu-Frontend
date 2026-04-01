import { create } from "zustand";
import type { DirectoryReply } from "../api/models/directory";

interface DirectoryState {
  // Mapping directory ID -> Directory instance.
  directoriesById: Record<string, DirectoryReply>;
  setDirectories: (directories: DirectoryReply[]) => void;
  upsertDirectory: (directory: DirectoryReply) => void;
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
  removeDirectory: (id: string) =>
    set((state) => {
      const directoriesById = { ...state.directoriesById };
      delete directoriesById[id];
      return { directoriesById };
    }),
  clearDirectories: () => set({ directoriesById: {} }),
}));