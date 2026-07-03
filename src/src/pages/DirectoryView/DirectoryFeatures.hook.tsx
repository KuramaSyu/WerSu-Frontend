import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import type { ListDirectoriesQuery } from "../../api/DirectoryApi";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import {
  DirectoryHierarchyBuilder,
  type HirarchyItem,
} from "../../models/HirarchyItem";
import type { MinimalNote } from "../../api/models/search";
import { getNoteParentDirectoryIds } from "../../utils/fileGraphUtils";
import { useLatestNotes } from "../../api/queries/useNoteQueries";
import { NoteApi } from "../../api/NoteApi";
import { note_of_date_at_hour } from "../../utils/NoteTitleTemplates";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { UserError } from "../../api/models/UserError";

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
 */
const buildNotesByDirectory = (
  notes: MinimalNote[],
): Record<string, MinimalNote[]> => {
  const dict: Record<string, MinimalNote[]> = {};

  notes.forEach((note) => {
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
  handleCreateNote: () => Promise<void>;
  handleRenameDirectory: () => void;
  navigate: ReturnType<typeof useNavigate>;
}

/**
 * Owns the directory view's data loading, derived state, and action handlers.
 *
 * Centralizes:
 * - fetching the directory list and notes
 * - building the hierarchy tree and resolving the current node
 * - grouping notes by their parent directory
 * - creating new notes and renaming directories
 */
export function useDirectoryFeatures(): DirectoryFeatures {
  const { id } = useParams();
  const navigate = useNavigate();
  const directoryId = id ?? "root";
  const { directoriesById, setDirectories } = useDirectoryStore();
  const { data: notes } = useLatestNotes();
  const { setMessage } = useInfoStore();

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
   * Creates a new note and (optionally) assigns it to the current directory.
   * The user is then navigated into the note editor.
   */
  const handleCreateNote = async () => {
    try {
      const api = new NoteApi();
      // Backend requires non-empty content, so seed with a single whitespace.
      const note = await api.post(note_of_date_at_hour(), " ");
      if (!note) {
        setMessage(new SnackbarUpdateImpl("Failed to create note", "error"));
        return;
      }

      console.log(
        `currend node id: ${currentNode.getId()}, note dir: ${note.get_dir()}, perms: ${JSON.stringify(note.permissions)}`,
      );
      if (
        currentNode.getId() !== "root" &&
        currentNode.getId() !== note.get_dir()
      ) {
        const moved = await api.patchDirectory(note.id, currentNode.getId());
        if (!moved) {
          setMessage(
            new SnackbarUpdateImpl(
              "Note created, but failed to assign directory",
              "warning",
            ),
          );
        }
      }

      navigate(`/n/${note.id}`);
    } catch (error) {
      if (error instanceof UserError) {
        setMessage(
          new SnackbarUpdateImpl(
            error.title,
            "error",
            undefined,
            error.description,
          ),
        );
        return;
      }
      setMessage(new SnackbarUpdateImpl("Unexpected error", "error"));
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

  return {
    currentNode,
    path,
    childDirectories,
    notesByDirectory,
    notesInDirectory,
    title,
    handleCreateNote,
    handleRenameDirectory,
    navigate,
  };
}
