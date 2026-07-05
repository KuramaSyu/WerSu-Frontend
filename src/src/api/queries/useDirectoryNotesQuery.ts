import { useQuery } from "@tanstack/react-query";
import { getDirectoryApi, type ListDirectoryNotesQuery } from "../DirectoryApi";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const directoryApi = getDirectoryApi();

export const directoryNotesQueryKeys = {
  all: ["directory", "notes"] as const,
  list: (directoryId: string, query: ListDirectoryNotesQuery = {}) =>
    ["directory", "notes", directoryId, query] as const,
};

/**
 * Fetches the notes attached to a directory via
 * `GET /api/directories/:id/notes/?limit=...&offset=...`.
 *
 * The backend always returns the directory's `README.md` note (with full
 * `content` carried in `stripped_content`) on the first page; other notes
 * are returned with stripped content only.
 */
export function useDirectoryNotesQuery(
  directoryId?: string,
  query: ListDirectoryNotesQuery = {},
) {
  return useQuery({
    queryKey: directoryNotesQueryKeys.list(directoryId ?? "", query),
    queryFn: () => {
      if (!directoryId) {
        throw new Error("directoryId required");
      }
      return directoryApi.listNotes(directoryId, query);
    },
    enabled: !!directoryId,
  });
}
