import { useMemo } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { DirectoryReply } from "../models/directory";
import { getDirectoryApi, type ListDirectoriesQuery } from "../DirectoryApi";
import { useAuthStore } from "../../zustand/useAuthStore";
import { useIsAuthenticated, useUserKey } from "./useUser";

// Resolve through the api registry so the share-token provider installed on Bootstrap reaches this instance.
const directoryApi = getDirectoryApi();

// Backoff schedule for retrying an empty list. First interval is generous so a freshly-logged-in session has time to settle.
const EMPTY_POLL_SCHEDULE_MS = [
  10_000, // 10s
  30_000, // 30s
  60_000, // 1m
  300_000, // 5m
] as const;

// Tracks how many consecutive empty responses each queryKey has seen. Lives at module scope for refetchInterval callback closures.
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
  const isAuthed = useIsAuthenticated();
  return useQuery({
    queryKey: directoryQueryKeys.list(userKey, query),
    queryFn: async () => await directoryApi.list(query),
    // Gate on auth so the call does not fire on the cold-start frame before the session cookie settles.
    enabled: enabled && isAuthed,
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

// Fetches a single DirectoryReply by id. Pass empty or undefined id to skip.
export const useDirectoryByIdQuery = (id: string | undefined) => {
  const userKey = useUserKey();
  return useQuery({
    queryKey: directoryQueryKeys.byId(userKey, id ?? ""),
    queryFn: async () => {
      if (!id) {
        throw new Error("id required");
      }
      // Override include_child_notes so the populated child_note_ids from the list call survive the merge.
      return await directoryApi.get(id, { include_child_notes: true });
    },
    enabled: !!id,
  });
};

// Wraps useDirectoriesQuery with limit 500 offset 0 and returns a memoised lookup table.
export interface AllDirectoriesQueryResult {
  // Raw list payload. Undefined while loading.
  list: DirectoryReply[] | undefined;
  // Memoised lookup table. Empty object while loading.
  byId: Record<string, DirectoryReply>;
  // True while the underlying query is in flight.
  isLoading: boolean;
}

export function useAllDirectoriesQuery(
  enabled = true,
): AllDirectoriesQueryResult {
  const { data, isLoading } = useDirectoriesQuery(
    { limit: 500, offset: 0 },
    enabled,
  );
  const byId = useMemo<Record<string, DirectoryReply>>(() => {
    const map: Record<string, DirectoryReply> = {};
    if (data) {
      for (const directory of data) {
        map[directory.id] = directory;
      }
    }
    return map;
  }, [data]);
  return { list: data, byId, isLoading };
}

// Mirrors a freshly-created or patched DirectoryReply into every cached list payload.
export const upsertDirectory = (
  queryClient: QueryClient,
  directory: DirectoryReply,
): void => {
  queryClient.setQueriesData<DirectoryReply[] | undefined>(
    { queryKey: ["directories", "list"] },
    (prev) => {
      if (!prev) {
        return prev;
      }
      // filter out old one (if present)
      const next = prev.filter((d) => d.id !== directory.id);

      // add created/updated version
      next.push(directory);
      return next;
    },
  );
};

// Removes a directory from every cached list-query payload.
export const removeDirectory = (
  queryClient: QueryClient,
  directoryId: string,
): void => {
  queryClient.setQueriesData<DirectoryReply[] | undefined>(
    { queryKey: ["directories", "list"] },
    // filter out the deleted directory from every cached list
    (prev) => (prev ? prev.filter((d) => d.id !== directoryId) : prev),
  );
};
