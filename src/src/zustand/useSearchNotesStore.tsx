import { create } from "zustand";
import type {
  MinimalNote,
  PermissionRelationshipReply,
} from "../api/models/search";

interface SearchNotesState {
  notes: MinimalNote[];
  setNotes: (notes: MinimalNote[]) => void;
  updateNoteParentDirectory: (noteId: string, directoryId?: string) => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
}

export const useSearchNotesStore = create<SearchNotesState>((set) => ({
  notes: [],
  setNotes: (notes: MinimalNote[]) => set({ notes: notes }),
  isModalOpen: false,
  setIsModalOpen: (open: boolean) => set({ isModalOpen: open }),
  isSearching: false,
  setIsSearching: (searching: boolean) => set({ isSearching: searching }),
  /**
   * Mirrors a successful backend move into local search results, so grouped
   * directory UI updates immediately without requiring a refetch.
   */
  updateNoteParentDirectory: (noteId: string, directoryId?: string) =>
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }

        const existingPermissions = note.permissions ?? [];

        const parentRelations = existingPermissions.filter((permission) => {
          const isParentRelation =
            permission.relation === "parent" ||
            permission.relation === "parent_directory";
          const isDirectorySubject =
            permission.subject.object_type ===
            "PERMISSION_OBJECT_TYPE_DIRECTORY";
          return isParentRelation && isDirectorySubject;
        });

        // If no directory is provided, clear all parent relations (root).
        if (!directoryId) {
          const cleanedPermissions = existingPermissions.filter(
            (permission) => {
              const isParentRelation =
                permission.relation === "parent" ||
                permission.relation === "parent_directory";
              const isDirectorySubject =
                permission.subject.object_type ===
                "PERMISSION_OBJECT_TYPE_DIRECTORY";
              return !(isParentRelation && isDirectorySubject);
            },
          );
          return { ...note, permissions: cleanedPermissions };
        }

        const hasParent = parentRelations.some(
          (relation) => relation.subject.object_id === directoryId,
        );

        if (hasParent) {
          return note;
        }

        const nextParentRelation: PermissionRelationshipReply = {
          relation: "parent_directory",
          resource: {
            object_id: note.id,
            object_type: "PERMISSION_OBJECT_TYPE_NOTE",
          },
          subject: {
            object_id: directoryId,
            object_type: "PERMISSION_OBJECT_TYPE_DIRECTORY",
          },
        };

        return {
          ...note,
          permissions: [...existingPermissions, nextParentRelation],
        };
      }),
    })),
}));
