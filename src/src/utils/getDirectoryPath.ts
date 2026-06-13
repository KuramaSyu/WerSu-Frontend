import { useQueryClient } from "@tanstack/react-query";
import { Note, type MinimalNote } from "../api/models/search";
import { useDirectoryStore } from "../zustand/useDirectoryStore";
import type { DirectoryReply } from "../api/models/directory";

/**
 * Retrieves the full directory path for a note by its ID.
 * @param noteID - The unique identifier of the note
 * @returns A string representing the full directory path separated by " > ", or "no path" if the note is not found
 * @example
 * const path = getDirectoryPath("note-123");
 * // Returns: "root > subfolder > notes"
 */
export function getDirectoryPath(noteID: string): string {
  const notes = useQueryClient()
    .getQueriesData<{ pages: MinimalNote[] }>({
      queryKey: ["notes", "search"],
    })
    ?.flatMap(([, notes]) => notes?.pages ?? [])
    .flat();
  console.log("notes in getDirectoryPath", notes);
  if (!notes) {
    return "no path";
  }
  const note = notes.find((n) => n.id === noteID);
  console.log("note in getDirectoryPath", note);
  if (!note) {
    return "no path";
  }

  var path = [];
  const parent = new Note({ content: "", ...note }).get_dir();
  for (const dir of getDirectoryPathFromDirectory(parent, []) ?? []) {
    path.push(dir.display_name || dir.name);
  }
  return path.join(" > ");
}

function getDirectoryPathFromDirectory(
  directoryID: string | null | undefined,
  directories: DirectoryReply[],
): DirectoryReply[] | undefined {
  if (!directoryID) {
    return undefined;
  }

  const currentDir = useDirectoryStore.getState().directoriesById[directoryID];
  if (!currentDir) {
    return undefined;
  }
  // if list is empty, insert given directoryID
  if (directories.length === 0) {
    return getDirectoryPathFromDirectory(directoryID, [currentDir]);
  }
  return [
    ...(getDirectoryPathFromDirectory(currentDir.parent_id, directories) ?? []),
    currentDir,
  ].flat();
}
