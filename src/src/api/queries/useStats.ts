import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { getStatsApi } from "../StatsApi";
import type { CalculatedStatsReply } from "../models/stats";
import { useIsAuthenticated, useUserKey } from "./useUser";

// Resolve through the registry so the share-token provider installed on
// Bootstrap reaches this instance.
const statsApi = getStatsApi();

/**
 * How long a stats row stays fresh in the query cache. The backend only
 * recomputes stats daily, so there is no point hammering the endpoint while
 * the Home greeting cycles between the greeting and the stats view.
 */
export const STATS_STALE_TIME_MS = 5 * 60 * 1000;

export const statsQueryKeys = {
  /** Root key for every stats query. */
  all: ["stats"] as const,

  /**
   * Key for one user's stats row. `targetUserId` is omitted for the caller's
   * own row; `userKey` keeps separate identities from sharing a cache entry.
   */
  detail: (userKey: string | null, targetUserId?: string) =>
    [...statsQueryKeys.all, targetUserId ?? "me", userKey] as const,
};

type StatsQueryKey = ReturnType<typeof statsQueryKeys.detail>;

export type UseStatsOptions = Omit<
  UseQueryOptions<
    CalculatedStatsReply,
    Error,
    CalculatedStatsReply,
    StatsQueryKey
  >,
  "queryKey" | "queryFn"
>;

/**
 * Fetch a precomputed stats row.
 *
 * Pass `targetUserId` to read another user's row; omit it for the caller's
 * own row. The query is auth-gated and disabled until `enabled` (from
 * `options`) is true — the Home greeting uses this to defer the request for
 * the first few seconds instead of fetching on startup.
 */
export function useStats(targetUserId?: string, options?: UseStatsOptions) {
  const isAuthed = useIsAuthenticated();
  const userKey = useUserKey();
  const { enabled, ...restOptions } = options ?? {};

  return useQuery({
    queryKey: statsQueryKeys.detail(userKey, targetUserId),
    queryFn: () =>
      targetUserId
        ? statsApi.getStatsForUser(targetUserId)
        : statsApi.getStats(),
    staleTime: STATS_STALE_TIME_MS,
    ...restOptions,
    enabled: isAuthed && (enabled ?? true),
  });
}

/** Fetch another user's precomputed stats row. */
export function useStatsForUser(userId: string, options?: UseStatsOptions) {
  return useStats(userId, options);
}
