import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getHistoryApi } from "../HistoryApi";
import type {
  ActivityReply,
  ActivityScoreReply,
  HistoryFilter,
} from "../models/history";

// Use the registered singleton so the share-token provider
// installed on `Bootstrap` reaches this instance. See
// `useNoteQueries` for rationale (a fresh `new HistoryApi()`
// would not receive the provider).
const historyApi = getHistoryApi();

export const historyQueryKeys = {
  all: ["history"] as const,
  activity: (filter: HistoryFilter) => ["history", "activity", filter] as const,
  mostUsed: (filter: HistoryFilter) =>
    ["history", "most-used", filter] as const,
};

/**
 * Fetches activity history rows for the given filter.
 *
 * The hook is gated on `filter.mode` being `"history"`. If a
 * caller accidentally passes a `most_used` filter, the request is
 * not fired (the dedicated `useMostUsedActivity` hook should be
 * used instead).
 */
export function useActivityHistory(
  filter: HistoryFilter,
): UseQueryResult<ActivityReply[], Error> {
  return useQuery({
    queryKey: historyQueryKeys.activity(filter),
    queryFn: () => historyApi.getActivityHistory(filter),
    enabled: filter.mode === "history",
  });
}

/**
 * Fetches aggregated most-used note scores for the given filter.
 *
 * The hook is gated on `filter.mode` being `"most_used"`.
 */
export function useMostUsedActivity(
  filter: HistoryFilter,
): UseQueryResult<ActivityScoreReply[], Error> {
  return useQuery({
    queryKey: historyQueryKeys.mostUsed(filter),
    queryFn: () => historyApi.getMostUsed(filter),
    enabled: filter.mode === "most_used",
  });
}
