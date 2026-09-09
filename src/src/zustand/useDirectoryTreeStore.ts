import { create } from "zustand";
import type { MinimalNote } from "../api/models/search";
import type { DirectoryReply } from "../api/models/directory";
import {
  DirectoryHierarchyBuilder,
  DirectoryHirarchyItem,
  NoteHirarchyItem,
  RootHirarchyItem,
  ShelfHirarchyItem,
  type HirarchyItem,
} from "../models/HirarchyItem";
import { useSelectedShelfStore } from "./useSelectedShelfStore";

/** Cached shelf-scoped directory tree plus shelf-membership helpers. */

interface DirectoryTreeState {
  /** Latest built tree; null until the first rebuild. */
  tree: RootHirarchyItem | null;
  /** Rebuild from directoryLookup and optionally attach notes. */
  rebuild: (
    directoryLookup: Record<string, DirectoryReply>,
    attachedNotes?: ReadonlyArray<MinimalNote> | null,
  ) => void;
  /** Drops the cached tree (logout / cache wipes). */
  clear: () => void;
  /** True when the directory is a member of (or descendant of) the shelf. */
  isDirectoryOnShelf: (directoryId: string, shelfId: string) => boolean;
  /** True when the note has at least one parent directory on the shelf. */
  isNoteOnShelf: (note: MinimalNote, shelfId: string) => boolean;
}

/** Walks the tree and returns every directory id reachable from the shelf root. */
const collectShelfDirectoryIds = (
  shelfRoot: ShelfHirarchyItem,
): Set<string> => {
  const out = new Set<string>();
  const visit = (node: HirarchyItem): void => {
    if (node instanceof ShelfHirarchyItem) {
      for (const child of node.getChildren()) {
        visit(child);
      }
      return;
    }
    if (node instanceof DirectoryHirarchyItem) {
      out.add(node.getId());
    }
    for (const child of node.getChildren()) {
      visit(child);
    }
  };
  visit(shelfRoot);
  return out;
};

export const useDirectoryTreeStore = create<DirectoryTreeState>()((set, get) => {
  /** Rebuild the tree for shelfId; null falls back to the global root. */
  const buildTree = (
    directoryLookup: Record<string, DirectoryReply>,
    shelfId: string | null,
    notes: ReadonlyArray<MinimalNote>,
  ): RootHirarchyItem => {
    return new DirectoryHierarchyBuilder(directoryLookup).build("Stacks", {
      rootName: shelfId === null ? "Stacks" : "Shelf",
      shelfId,
      attachedNotes: notes,
    });
  };

  return {
    tree: null,

    rebuild: (directoryLookup, attachedNotes = null) => {
      const shelfId = useSelectedShelfStore.getState().selectedShelfId;
      const notes = attachedNotes ?? [];
      const tree = buildTree(directoryLookup, shelfId, notes);
      set({ tree });
    },

    clear: () => set({ tree: null }),

    isDirectoryOnShelf: (directoryId, shelfId) => {
      const tree = get().tree;
      if (!tree) {
        return false;
      }
      // No shelf selected: every directory counts.
      const activeShelfId =
        useSelectedShelfStore.getState().selectedShelfId ?? shelfId;
      if (activeShelfId === null) {
        return true;
      }
      // Shelf-scoped builds make the ShelfHirarchyItem the root itself.
      const shelfRoot =
        tree instanceof ShelfHirarchyItem && tree.getId() === activeShelfId
          ? tree
          : tree
              .getChildren()
              .find(
                (c) =>
                  c instanceof ShelfHirarchyItem &&
                  c.getId() === activeShelfId,
              );
      if (!(shelfRoot instanceof ShelfHirarchyItem)) {
        // Tree was built without shelf scoping; fall back to global view.
        return true;
      }
      const ids = collectShelfDirectoryIds(shelfRoot);
      return ids.has(directoryId);
    },

    isNoteOnShelf: (note, shelfId) => {
      const tree = get().tree;
      if (!tree) {
        return false;
      }
      const activeShelfId =
        useSelectedShelfStore.getState().selectedShelfId ?? shelfId;
      if (activeShelfId === null) {
        return true;
      }
      const shelfRoot =
        tree instanceof ShelfHirarchyItem && tree.getId() === activeShelfId
          ? tree
          : tree
              .getChildren()
              .find(
                (c) =>
                  c instanceof ShelfHirarchyItem &&
                  c.getId() === activeShelfId,
              );
      if (!(shelfRoot instanceof ShelfHirarchyItem)) {
        return true;
      }
      const ids = collectShelfDirectoryIds(shelfRoot);
      const parents = note.directory_ids ?? [];
      return parents.some((p) => ids.has(p));
    },
  };
});

/** Returns every note id attached under the given shelf root. */
export const collectNoteIdsUnder = (
  tree: RootHirarchyItem | ShelfHirarchyItem | null,
  shelfId: string | null,
): Set<string> => {
  if (tree === null) {
    return new Set();
  }
  if (shelfId === null) {
    // No shelf scope: every note in the tree counts.
    const out = new Set<string>();
    const visit = (node: HirarchyItem): void => {
      if (node instanceof NoteHirarchyItem) {
        out.add(node.getNoteId());
      }
      for (const child of node.getChildren()) {
        visit(child);
      }
    };
    for (const child of tree.getChildren()) {
      visit(child);
    }
    return out;
  }
  const shelfRoot =
    tree instanceof ShelfHirarchyItem && tree.getId() === shelfId
      ? tree
      : tree
          .getChildren()
          .find((c) => c instanceof ShelfHirarchyItem && c.getId() === shelfId);
  if (!(shelfRoot instanceof ShelfHirarchyItem)) {
    return new Set();
  }
  const out = new Set<string>();
  const visit = (node: HirarchyItem): void => {
    if (node instanceof NoteHirarchyItem) {
      out.add(node.getNoteId());
    }
    for (const child of node.getChildren()) {
      visit(child);
    }
  };
  for (const child of shelfRoot.getChildren()) {
    visit(child);
  }
  return out;
};