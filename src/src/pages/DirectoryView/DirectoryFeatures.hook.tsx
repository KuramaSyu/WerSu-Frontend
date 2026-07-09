import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import {
  DirectoryApi,
  type ListDirectoriesQuery,
} from "../../api/DirectoryApi";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import {
  DirectoryHierarchyBuilder,
  type HirarchyItem,
} from "../../models/HirarchyItem";
import type { MinimalNote } from "../../api/models/search";
import { getNoteParentDirectoryIds } from "../../utils/fileGraphUtils";
import { useLatestNotes } from "../../api/queries/useNoteQueries";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useRightPanel } from "../../LayoutProvider";
import { DirectoryRightPanel } from "./DirectoryRightPanel";

export interface UseDirectoryFeaturesOptions {
  /**
   * Invoked when the user picks "Create note" from the right-panel
   * actions. The host component owns the dialog state and is
   * responsible for mounting the shared `CreateNote` dialog.
   */
  onOpenCreateNote?: () => void;
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
    const parentIds = getNoteParentDirectoryIds(note.permissions);
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

export interface DirectoryFeatures {
  currentNode: HirarchyItem;
  path: HirarchyItem[];
  childDirectories: HirarchyItem[];
  notesByDirectory: Record<string, MinimalNote[]>;
  notesInDirectory: MinimalNote[];
  title: string;
  handleCreateNote: () => void;
  handleRenameDirectory: () => void;
  handleDeleteDirectory: () => void;
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
  const { directoriesById, setDirectories, removeDirectory } =
    useDirectoryStore();
  const { data: notes } = useLatestNotes();
  const { setMessage } = useInfoStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log("DirectoryView: notes updated: ", notes);
  }, [notes]);

  // Stable query object so the directory list fetch is memoized across rerenders.
  const directoryListQuery = useMemo<ListDirectoriesQuery>(
    () => ({ limit: 500, offset: 0 }),
    [],
  );

  const { data: directories } = useDirectoriesQuery(directoryListQuery, true);

  useEffect(() => {
    if (directories) {
      setDirectories(directories);
    }
  }, [directories, setDirectories]);

  // Build a full hierarchy tree so we can find the current node and its path.
  const directoryHierarchy = useMemo(
    () => new DirectoryHierarchyBuilder(directoriesById).build("Stacks"),
    [directoriesById],
  );

  // Resolve the currently visible node; fall back to root when not found.
  const currentNode = useMemo(
    () => findNodeById(directoryHierarchy, directoryId) ?? directoryHierarchy,
    [directoryHierarchy, directoryId],
  );

  // Precompute breadcrumb path for the current node.
  const path = useMemo(
    () => findPathById(directoryHierarchy, currentNode.getId()),
    [directoryHierarchy, currentNode],
  );

  // Group notes by their parent directory to render the list efficiently.
  const notesByDirectory = useMemo(
    () => buildNotesByDirectory(notes ?? []),
    [notes],
  );

  const childDirectories = currentNode.getChildren();
  const notesInDirectory = notesByDirectory[currentNode.getId()] ?? [];

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
   * Sends the user to the full directory edit page.
   */
  const handleRenameDirectory = () => {
    if (currentNode.getId() === "root") {
      setMessage(
        new SnackbarUpdateImpl("Root directory cannot be edited", "info"),
      );
      return;
    }

    navigate(`/d/${currentNode.getId()}/edit`);
  };

  /**
   * Deletes the current directory via the REST API, drops it from
   * the in-memory store, invalidates the cached directory queries
   * so other pages re-fetch, and navigates the user back home.
   * No-op for the synthetic root node.
   */
  const handleDeleteDirectory = async () => {
    const targetId = currentNode.getId();
    if (targetId === "root") {
      setMessage(
        new SnackbarUpdateImpl("Root directory cannot be deleted", "info"),
      );
      return;
    }

    const deleted = await new DirectoryApi().delete(targetId);
    if (!deleted) {
      setMessage(new SnackbarUpdateImpl("Failed to delete directory", "error"));
      return;
    }

    removeDirectory(targetId);
    queryClient.invalidateQueries({ queryKey: ["directories"] });
    queryClient.invalidateQueries({ queryKey: ["directory", targetId] });
    setMessage(new SnackbarUpdateImpl("Directory deleted", "success"));
    navigate("/");
  };

  // Mount the title-level directory actions in the right panel while this
  // view is active. The hook clears the panel on unmount.
  useRightPanel(
    <DirectoryRightPanel
      currentNode={currentNode}
      handleCreateNote={handleCreateNote}
      handleRenameDirectory={handleRenameDirectory}
      handleDeleteDirectory={handleDeleteDirectory}
    />,
  );

  return {
    currentNode,
    path,
    childDirectories,
    notesByDirectory,
    notesInDirectory,
    title,
    handleCreateNote,
    handleRenameDirectory,
    handleDeleteDirectory,
    navigate,
  };
}
