import { useQuery } from "@tanstack/react-query";
import { getDirectoryApi } from "../DirectoryApi";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const directoryApi = getDirectoryApi();

export const directoryQueryKeys = {
  all: ["directory"] as const,
  detail: (directoryId: string) => ["directory", directoryId] as const,
};

/**
 * Fetches a single directory by id via `GET /api/directories/:id`.
 *
 * Returns `undefined` while loading, `null` on a 404 / failed lookup, and
 * a `DirectoryReply` otherwise. Consumers should fall back to `[]`/`""` on
 * `null` rather than rendering the loading state — the page renders from
 * cached `useDirectoryStore` data while this query is in flight.
 */
export function useDirectory(directoryId?: string) {
  return useQuery({
    queryKey: directoryQueryKeys.detail(directoryId ?? ""),
    queryFn: async () => {
      if (!directoryId) {
        return null;
      }
      return (await directoryApi.get(directoryId)) ?? null;
    },
    enabled: !!directoryId,
  });
}
