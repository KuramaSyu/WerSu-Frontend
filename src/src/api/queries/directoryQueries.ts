import { useQuery } from "@tanstack/react-query";
import { getDirectoryApi, type ListDirectoriesQuery } from "../DirectoryApi";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const directoryApi = getDirectoryApi();

export const directoryQueryKeys = {
  all: ["directories"] as const,
  list: (query: ListDirectoriesQuery = {}) =>
    ["directories", "list", query] as const,
  byId: (id: string) => ["directories", "byId", id] as const,
};

export const useDirectoriesQuery = (
  query: ListDirectoriesQuery,
  enabled: boolean,
) =>
  useQuery({
    queryKey: directoryQueryKeys.list(query),
    queryFn: async () => await directoryApi.list(query),
    enabled,
  });

/**
 * Fetches a single `DirectoryReply` by id. Always enabled - pass an
 * empty / undefined id if you want to skip the fetch (the API call
 * will be a no-op against the backend).
 *
 * Used by nested `ChapterAccordion`s to hydrate the row badge with
 * populated `child_note_ids` / `child_dir_ids` before the user
 * expands the chapter.
 */
export const useDirectoryByIdQuery = (id: string | undefined) =>
  useQuery({
    queryKey: directoryQueryKeys.byId(id ?? ""),
    queryFn: async () => {
      if (!id) {
        throw new Error("id required");
      }
      return await directoryApi.get(id);
    },
    enabled: !!id,
  });
