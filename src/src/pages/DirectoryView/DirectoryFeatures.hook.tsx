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

export interface DirectoryFeatures {
  currentNode: HirarchyItem;
  path: HirarchyItem[];
  childDirectories: HirarchyItem[];
  notesByDirectory: Record<string, MinimalNote[]>;
  notesInDirectory: MinimalNote[];
  title: string;
  handleCreateNote: () => void;
  handleCreateSubdirectory: () => void;
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
  const { directoriesById, setDirectories, upsertDirectory, removeDirectory } =
    useDirectoryStore();
  const { data: notes } = useLatestNotes();
  const { setMessage } = useInfoStore();
  const queryClient = useQueryClient();

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
  // Directory-scoped fetch wins; fall back to the latest-notes grouping while loading or on the root.
  const notesInDirectory =
    directoryNotes ?? notesByDirectory[currentNode.getId()] ?? [];

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
   * Opens the dedicated `CreateSubdirectory` page, pre-scoped to the
   * current directory via the `:id` route param. The page handles the
   * form, validation, and the actual `POST /api/directories` call.
   */
  const handleCreateSubdirectory = (): void => {
    navigate(`/d/${currentNode.getId()}/new`);
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
  // view is active. We pass `[currentNode]` as the dep array so the
  // panel re-pushes into the context once the directory store hydrates
  // and the resolved node transitions from the synthetic root
  // fallback to the real directory. Without the dep, the panel
  // would mount once on the first render (with the loading-time
  // fallback) and never refresh — leaving every `disabled={isRoot}`
  // button grayed out on a hard reload of `/d/:id`.
  useRightPanel(
    <DirectoryRightPanel
      currentNode={currentNode}
      handleCreateNote={handleCreateNote}
      handleCreateSubdirectory={handleCreateSubdirectory}
      handleRenameDirectory={handleRenameDirectory}
      handleDeleteDirectory={handleDeleteDirectory}
    />,
    [currentNode],
  );

  return {
    currentNode,
    path,
    childDirectories,
    notesByDirectory,
    notesInDirectory,
    title,
    handleCreateNote,
    handleCreateSubdirectory,
    handleRenameDirectory,
    handleDeleteDirectory,
    navigate,
  };
}
