import { useQueryClient } from "@tanstack/react-query";
import { Note, type MinimalNote, type NotesReply } from "../api/models/search";
import { directoryQueryKeys } from "../api/queries/directoryQueries";
import type { DirectoryReply } from "../api/models/directory";
import type { ShelfReply } from "../api/models/shelf";

/**
 * Retrieves the full directory path for a note by its ID.
 * @param noteID - The unique identifier of the note
 * @returns A string representing the full directory path separated by " > ", or "no path" if the note is not found
 * @example
 * const path = getDirectoryPathFromNote("note-123");
 * // Returns: "root > subfolder > notes"
 */
export function getDirectoryPathFromNote(noteID: string): string {
  const queryClient = useQueryClient();
  const replies = queryClient
    .getQueriesData<NotesReply>({
      queryKey: ["notes", "search"],
    })
    ?.flatMap(([, reply]) => (reply ? [reply] : []));
  const notes: MinimalNote[] = replies?.flatMap((reply) => reply.notes) ?? [];
  console.log("notes in getDirectoryPath", notes);

  if (!notes) {
    return "no path";
  }

  const note = notes.find((n) => n.id === noteID);
  console.log("note in getDirectoryPath", note);
  if (!note) {
    return "no path";
  }

  const parent = new Note({ content: "", ...note }).get_dir();
  const chain = getDirectoryPathFromDirectory(queryClient, parent) ?? [];
  const withShelf = prependShelfIfTopLevel(queryClient, chain);

  return withShelf
    .map((dir) => dir.display_name || dir.name || dir.slug || dir.id)
    .join(" > ");
}

/**
 * Walks parent_dir_ids[0] from `directoryID` upward, returning the
 * chain in root-first order. Returns undefined when the seed id is
 * null/undefined or the directory isn't in any cached list.
 */
function getDirectoryPathFromDirectory(
  queryClient: ReturnType<typeof useQueryClient>,
  directoryID: string | null | undefined,
): DirectoryReply[] | undefined {
  if (!directoryID) {
    return undefined;
  }

  const currentDir = queryClient
    .getQueriesData<DirectoryReply[] | undefined>({
      queryKey: directoryQueryKeys.all,
    })
    ?.find(([, list]) => list?.some((d) => d.id === directoryID))?.[1]
    ?.find((d) => d.id === directoryID);
  if (!currentDir) {
    return undefined;
  }

  return [
    ...(getDirectoryPathFromDirectory(
      queryClient,
      currentDir.parent_dir_ids?.[0],
    ) ?? []),
    currentDir,
  ];
}

/**
 * check if the top-level dir has a shelf, and if so
 * prepend it to the chain as a DirectoryReply.
 */
function prependShelfIfTopLevel(
  queryClient: ReturnType<typeof useQueryClient>,
  chain: DirectoryReply[],
): DirectoryReply[] {
  const top = chain[0];
  if (!top) {
    return chain;
  }
  if ((top.parent_dir_ids?.length ?? 0) > 0) {
    return chain;
  }
  const firstShelfId = top.shelf_ids?.[0];
  if (!firstShelfId) {
    return chain;
  }
  const shelf = lookupShelf(queryClient, firstShelfId);
  if (!shelf) {
    return chain;
  }
  return [shelfAsDirectoryReply(shelf), ...chain];
}

/** Finds a shelf in any cached shelf-list query payload. */
const lookupShelf = (
  queryClient: ReturnType<typeof useQueryClient>,
  shelfId: string,
): ShelfReply | undefined => {
  const cached = queryClient.getQueriesData<ShelfReply[] | undefined>({
    queryKey: ["shelves"],
  });
  for (const [, list] of cached) {
    if (!list) {
      continue;
    }
    const found = list.find((s) => s.id === shelfId);
    if (found) {
      return found;
    }
  }
  return undefined;
};

/** Projects a shelf into the DirectoryReply shape the formatter expects. */
const shelfAsDirectoryReply = (shelf: ShelfReply): DirectoryReply => ({
  id: shelf.id,
  display_name: shelf.display_name,
  slug: shelf.slug,
  parent_dir_ids: [],
  child_dir_ids: [],
  child_note_ids: [],
  shelf_ids: [],
});
