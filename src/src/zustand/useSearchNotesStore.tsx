import { create } from "zustand";
import type {
  MinimalNote,
  PermissionRelationshipReply,
} from "../api/models/search";

interface SearchNotesState {
  notes: MinimalNote[];
  setNotes: (notes: MinimalNote[]) => void;
  updateNoteParentDirectory: (noteId: string, directoryId?: string) => void;
}

export const useSearchNotesStore = create<SearchNotesState>((set) => ({
  notes: [],
  setNotes: (notes: MinimalNote[]) => set({ notes: notes }),
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

        const cleanedPermissions = (note.permissions ?? []).filter(
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

        // Keep note at root if no target directory was provided.
        if (!directoryId) {
          return { ...note, permissions: cleanedPermissions };
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
          permissions: [...cleanedPermissions, nextParentRelation],
        };
      }),
    })),
}));
