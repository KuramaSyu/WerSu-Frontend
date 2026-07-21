import { useQuery } from "@tanstack/react-query";
import { getDirectoryApi } from "../DirectoryApi";
import { UserError } from "../models/UserError";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const directoryApi = getDirectoryApi();

// 403 is permanent (access denied) — retrying just delays the user-facing
// reaction. Any other failure keeps the default retry policy.
const shouldRetryFetchDirectory = (
  failureCount: number,
  error: unknown,
): boolean => {
  if (error instanceof UserError && error.status === 403) {
    return false;
  }
  return failureCount < 3;
};

export const directoryQueryKeys = {
  all: ["directory"] as const,
  detail: (directoryId: string) => ["directory", directoryId] as const,
};

/**
 * Fetches a single directory by id via `GET /api/directories/:id`.
 *
 * Returns `undefined` while loading, a `DirectoryReply` on success, and
 * surfaces the underlying `UserError` (with `status`) on a non-OK
 * response. Consumers should fall back to cached data on `error` rather
 * than rendering the loading state — the page renders from the
 * `useDirectoryStore` cache while this query is in flight.
 */
export function useDirectory(directoryId?: string) {
  return useQuery({
    queryKey: directoryQueryKeys.detail(directoryId ?? ""),
    queryFn: async () => {
      if (!directoryId) {
        return null;
      }
      return await directoryApi.get(directoryId);
    },
    enabled: !!directoryId,
    retry: shouldRetryFetchDirectory,
  });
}
