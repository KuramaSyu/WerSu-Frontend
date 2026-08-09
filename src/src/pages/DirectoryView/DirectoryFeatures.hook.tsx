import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useDirectoryNotesQuery } from "../../api/queries/useDirectoryNotesQuery";
import {
  DirectoryApi,
  type ListDirectoriesQuery,
  type ListDirectoryNotesQuery,
} from "../../api/DirectoryApi";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import {
  DirectoryHierarchyBuilder,
  DirectoryHirarchyItem,
  type HirarchyItem,
} from "../../models/HirarchyItem";
import type { MinimalNote } from "../../api/models/search";
import { getNoteParentDirectoryIds } from "../../utils/fileGraphUtils";
import { useLatestNotes } from "../../api/queries/useNoteQueries";
import { useUserKey } from "../../api/queries/useUser";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";

export interface UseDirectoryFeaturesOptions {
  /**
   * Invoked when the user picks "Create note" from the right-panel
   * actions. The host component owns the dialog state and is
   * responsible for mounting the shared `CreateNote` dialog.
   */
  onOpenCreateNote?: () => void;
  /**
   * Invoked when the user picks "New subdirectory" from the right-panel
   * FAB. The host component owns the modal state and mounts the shared
   * `CreateDirectoryModal` in `create` mode.
   */
  onOpenCreateDirectory?: (parentId: string) => void;
  /**
   * Invoked when the user picks "Edit directory" from the right-panel
   * actions. The host component owns the modal state and mounts the
   * shared `CreateDirectoryModal` in `edit` mode, targeting the
   * current directory.
   */
  onOpenEditDirectory?: (directoryId: string) => void;
}

const findNodeById = (root: HirarchyItem, id: string): HirarchyItem | null => {
  if (root.getId() === id) {
    return root;
  }

  for (const child of root.getChildren()) {
    const found = findNodeById(child, id);
    if (found) {
      return found;
    }
  }

  return null;
};

/**
 * Recursively searches for a node by its ID within a hierarchical structure
 * and returns the path from the root to that node.
 */
const findPathById = (root: HirarchyItem, id: string): HirarchyItem[] => {
  if (root.getId() === id) {
    return [root];
  }

  for (const child of root.getChildren()) {
    const path = findPathById(child, id);
    if (path.length > 0) {
      return [root, ...path];
    }
  }

  return [];
};

/**
 * Organizes an array of notes into a dictionary, grouping them by their parent directory ID.
 *
 * The directory's `README.md` note is filtered out
 */
const buildNotesByDirectory = (
  notes: MinimalNote[],
): Record<string, MinimalNote[]> => {
  const dict: Record<string, MinimalNote[]> = {};

  notes.forEach((note) => {
    if (note.title === "README.md") {
      return;
    }
    const parentIds = getNoteParentDirectoryIds(note.directory_ids);
    const targetDirs = parentIds.length === 0 ? ["root"] : parentIds;
    targetDirs.forEach((dir) => {
      if (!dict[dir]) {
        dict[dir] = [];
      }
      dict[dir].push(note);
    });
  });

  return dict;
};

/**
 * Pre-computed summary of what will be removed when deleting
 * `currentNode`. Walking the subtree lets the confirmation dialog
 * warn about cascade impact the user would otherwise be surprised by.
 */
export interface CascadePreview {
  /**
   * Notes that live directly inside the directory being deleted.
   * Already excludes the README per `buildNotesByDirectory`.
   */
  directNotes: MinimalNote[];
  /** All descendant directories of the one being deleted. */
  subdirectories: HirarchyItem[];
  /** Per-descendant-directory note count (README already excluded). */
  notesPerSubdirectory: Record<string, number>;
  /** Convenience: `subdirectories.length`. */
  totalSubdirectories: number;
  /** Convenience: total notes lost across this dir + every descendant. */
  totalNotes: number;
}

export interface DirectoryFeatures {
  currentNode: HirarchyItem;
  path: HirarchyItem[];
  childDirectories: HirarchyItem[];
  notesByDirectory: Record<string, MinimalNote[]>;
  notesInDirectory: MinimalNote[];
  /** Cascade-impact summary for the delete dialog. */
  cascadePreview: CascadePreview;
  title: string;
  handleCreateNote: () => void;
  handleCreateSubdirectory: () => void;
  handleRenameDirectory: () => void;
  /**
   * Deletes the current directory via the REST API, drops it from
   * the in-memory store, and invalidates the cached directory queries
   * so other pages re-fetch. Returns `true` on success and `false`
   * on failure. The caller is responsible for navigating away on
   * success and for surfacing the error to the user.
   */
  handleDeleteDirectory: () => Promise<boolean>;
  navigate: ReturnType<typeof useNavigate>;
}

/**
 * Owns the directory view's data loading, derived state, and action handlers.
 *
 * Centralizes:
 * - fetching the directory list and notes
 * - building the hierarchy tree and resolving the current node
 * - grouping notes by their parent directory
 * - opening the create-note dialog and renaming directories
 */
export function useDirectoryFeatures(
  options: UseDirectoryFeaturesOptions = {},
): DirectoryFeatures {
  const { id } = useParams();
  const navigate = useNavigate();
  const directoryId = id ?? "root";
  const { directoriesById, setDirectories, upsertDirectory, removeDirectory } =
    useDirectoryStore();
  const { data: notes } = useLatestNotes();
  const { setMessage } = useInfoStore();
  const queryClient = useQueryClient();
  const userKey = useUserKey();

  useEffect(() => {
    console.log("DirectoryView: notes updated: ", notes);
  }, [notes]);

  // Stable query object so the directory list fetch is memoized across rerenders.
  const directoryListQuery = useMemo<ListDirectoriesQuery>(
    () => ({
      limit: 500,
      offset: 0,
      include_child_dirs: true,
      include_child_notes: true,
    }),
    [],
  );

  const { data: directories } = useDirectoriesQuery(directoryListQuery, true);

  useEffect(() => {
    if (directories) {
      setDirectories(directories);
    }
  }, [directories, setDirectories]);

  // Build the hierarchy once per `directoriesById` snapshot.
  const directoryHierarchy = useMemo(
    () => new DirectoryHierarchyBuilder(directoriesById).build("Stacks"),
    [directoriesById],
  );

  // Fall back to the synthetic root when the route id is unknown.
  const currentNode = useMemo(
    () => findNodeById(directoryHierarchy, directoryId) ?? directoryHierarchy,
    [directoryHierarchy, directoryId],
  );

  // Directory-scoped fetch: `GET /api/directories/:id/notes?limit=500&offset=0`. Disabled on the root.
  const directoryNotesQuery = useMemo<ListDirectoryNotesQuery>(
    () => ({ limit: 500, offset: 0 }),
    [],
  );
  const notesDirectoryId =
    currentNode.getId() === "root" ? undefined : currentNode.getId();
  const { data: directoryNotesReply } = useDirectoryNotesQuery(
    notesDirectoryId,
    directoryNotesQuery,
  );
  const directoryNotes = directoryNotesReply?.notes;

  // Breadcrumb path for the current node.
  const path = useMemo(
    () => findPathById(directoryHierarchy, currentNode.getId()),
    [directoryHierarchy, currentNode],
  );

  // Drives the per-child pageCount badges across the whole tree.
  const notesByDirectory = useMemo(
    () => buildNotesByDirectory(notes ?? []),
    [notes],
  );

  const childDirectories = currentNode.getChildren();
  // load notes of directory. use fetched notes if loaded, otherwise cache.
  // for fetched notes, fliter out the first element which should be the README.md note.
  const notesInDirectory = useMemo<MinimalNote[]>(
    () =>
      directoryNotes
        ? directoryNotes.slice(1)
        : (notesByDirectory[currentNode.getId()] ?? []),
    [directoryNotes, notesByDirectory, currentNode],
  );

  // Cascade-impact summary for the delete confirmation dialog.
  // Walking the full subtree (not just direct children) is what
  // catches the "I thought it was just one folder" surprise: deleting
  // a directory cascades to every nested directory + every note that
  // lives anywhere inside the tree.
  const cascadePreview = useMemo<CascadePreview>(() => {
    const subdirectories: HirarchyItem[] = [];
    const notesPerSubdirectory: Record<string, number> = {};

    const walk = (node: HirarchyItem) => {
      for (const child of node.getChildren()) {
        if (child instanceof DirectoryHirarchyItem) {
          subdirectories.push(child);
          notesPerSubdirectory[child.getId()] =
            notesByDirectory[child.getId()]?.length ?? 0;
          walk(child);
        }
      }
    };
    walk(currentNode);

    const totalNotes =
      notesInDirectory.length +
      subdirectories.reduce(
        (acc, d) => acc + (notesPerSubdirectory[d.getId()] ?? 0),
        0,
      );

    return {
      directNotes: notesInDirectory,
      subdirectories,
      notesPerSubdirectory,
      totalSubdirectories: subdirectories.length,
      totalNotes,
    };
  }, [currentNode, notesByDirectory, notesInDirectory]);

  const title =
    currentNode.getId() === "root" ? "Directory View" : currentNode.getName();

  /**
   * Asks the host to open the shared `CreateNote` dialog, scoped to the
   * current directory. The dialog handles creation, directory
   * assignment, and navigation once the note is saved.
   */
  const handleCreateNote = () => {
    if (options.onOpenCreateNote) {
      options.onOpenCreateNote();
    } else {
      setMessage(
        new SnackbarUpdateImpl("Create note is not wired up here", "error"),
      );
    }
  };

  /**
   * Asks the host to open the shared `CreateDirectoryModal` in
   * create mode, pre-scoped to the current directory as the
   * parent. The modal owns the form, validation, and the actual
   * `POST /api/directories` call.
   */
  const handleCreateSubdirectory = (): void => {
    if (options.onOpenCreateDirectory) {
      options.onOpenCreateDirectory(currentNode.getId());
    } else {
      // Fallback to the route-driven flow for callers that haven't
      // mounted the modal yet.
      navigate(`/d/${currentNode.getId()}/new`);
    }
  };

  /**
   * Asks the host to open the shared `CreateDirectoryModal` in
   * edit mode, targeting the current directory. The modal owns the
   * form, validation, and the actual `PATCH /api/directories` call.
   */
  const handleRenameDirectory = () => {
    if (currentNode.getId() === "root") {
      setMessage(
        new SnackbarUpdateImpl("Root directory cannot be edited", "info"),
      );
      return;
    }

    if (options.onOpenEditDirectory) {
      options.onOpenEditDirectory(currentNode.getId());
    } else {
      navigate(`/d/${currentNode.getId()}/edit`);
    }
  };

  /**
   * Deletes the current directory via the REST API, drops it from
   * the in-memory store, and invalidates the cached directory queries
   * so other pages re-fetch. Returns `true` on success and `false`
   * on failure so the caller (e.g. the confirmation dialog) can
   * decide how to react. No-op for the synthetic root node.
   */
  const handleDeleteDirectory = async (): Promise<boolean> => {
    const targetId = currentNode.getId();
    if (targetId === "root") {
      setMessage(
        new SnackbarUpdateImpl("Root directory cannot be deleted", "info"),
      );
      return false;
    }

    const deleted = await new DirectoryApi().delete(targetId);
    if (!deleted) {
      setMessage(new SnackbarUpdateImpl("Failed to delete directory", "error"));
      return false;
    }

    removeDirectory(targetId);
    queryClient.invalidateQueries({ queryKey: ["directories"] });
    queryClient.invalidateQueries({
      queryKey: ["directory", targetId, userKey],
    });
    setMessage(new SnackbarUpdateImpl("Directory deleted", "success"));
    return true;
  };

  return {
    currentNode,
    path,
    childDirectories,
    notesByDirectory,
    notesInDirectory,
    cascadePreview,
    title,
    handleCreateNote,
    handleCreateSubdirectory,
    handleRenameDirectory,
    handleDeleteDirectory,
    navigate,
  };
}
