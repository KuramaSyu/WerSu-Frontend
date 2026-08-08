import { useQuery } from "@tanstack/react-query";
import { getDirectoryApi, type ListDirectoriesQuery } from "../DirectoryApi";
import { useAuthStore } from "../../zustand/useAuthStore";
import { useUserKey } from "./useUser";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const directoryApi = getDirectoryApi();

// Backoff schedule for retrying a directory list that keeps coming back
// empty. The first few intervals are tight (so a freshly-created
// directory appears quickly), then the cadence eases off to avoid
// hammering the backend once we suspect the user has no directories
// at all. The last entry is reused for every subsequent poll — there's
// no point in waiting longer than 5 minutes between checks.
const EMPTY_POLL_SCHEDULE_MS = [
  1_000, // 1s
  2_000, // 2s
  5_000, // 5s
  10_000, // 10s
  30_000, // 30s
  60_000, // 1m
  300_000, // 5m
] as const;

// Tracks how many consecutive empty responses each queryKey has seen.
// Lives at module scope because the `refetchInterval` callback closes
// over it; TanStack re-creates the callback on every poll, so an
// instance-local closure wouldn't survive. Keyed by the full queryKey
// tuple so concurrent calls with different filters don't share state.
const emptyStreakByKey = new Map<string, number>();

export const directoryQueryKeys = {
  all: ["directories"] as const,
  list: (userKey: string | null, query: ListDirectoriesQuery = {}) =>
    ["directories", "list", query, userKey] as const,
  byId: (userKey: string | null, id: string) =>
    ["directories", "byId", id, userKey] as const,
};

export const useDirectoriesQuery = (
  query: ListDirectoriesQuery,
  enabled: boolean,
) => {
  const userKey = useUserKey();
  return useQuery({
    queryKey: directoryQueryKeys.list(userKey, query),
    queryFn: async () => await directoryApi.list(query),
    enabled,
    // Re-poll on empty response, because after login no dirs are displayed
    refetchInterval: (q) => {
      const key = JSON.stringify(q.queryKey);
      const data = q.state.data;
      if (Array.isArray(data) && data.length > 0) {
        emptyStreakByKey.delete(key);
        return false;
      }
      // Only start counting once the first response has landed;
      if (data === undefined) {
        return false;
      }
      const streak = (emptyStreakByKey.get(key) ?? 0) + 1;
      emptyStreakByKey.set(key, streak);
      const idx = Math.min(streak - 1, EMPTY_POLL_SCHEDULE_MS.length - 1);
      return EMPTY_POLL_SCHEDULE_MS[idx];
    },
  });
};

/**
 * Fetches a single `DirectoryReply` by id. Always enabled - pass an
 * empty / undefined id if you want to skip the fetch (the API call
 * will be a no-op against the backend).
 *
 * Used by nested `ChapterAccordion`s to hydrate the row badge with
 * populated `child_note_ids` / `child_dir_ids` before the user
 * expands the chapter.
 */
export const useDirectoryByIdQuery = (id: string | undefined) => {
  const userKey = useUserKey();
  return useQuery({
    queryKey: directoryQueryKeys.byId(userKey, id ?? ""),
    queryFn: async () => {
      if (!id) {
        throw new Error("id required");
      }
      return await directoryApi.get(id);
    },
    enabled: !!id,
  });
};
