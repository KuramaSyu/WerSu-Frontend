import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getHistoryApi } from "../HistoryApi";
import {
  Activity,
  ActivityScore,
  type ActivityReply,
  type ActivityScoreReply,
  type HistoryFilter,
} from "../models/history";

// Use the registered singleton so the share-token provider installed on `Bootstrap` reaches this instance.
const historyApi = getHistoryApi();

export const historyQueryKeys = {
  all: ["history"] as const,
  activity: (filter: HistoryFilter) => ["history", "activity", filter] as const,
  mostUsed: (filter: HistoryFilter) =>
    ["history", "most-used", filter] as const,
};

/** Fetches activity history rows for the given filter; gated on `filter.mode === "history"`. Returns the raw `ActivityReply[]` wire shape. */
export function useActivityHistory(
  filter: HistoryFilter,
): UseQueryResult<ActivityReply[], Error> {
  return useQuery({
    queryKey: historyQueryKeys.activity(filter),
    queryFn: () => historyApi.getActivityHistory(filter),
    enabled: filter.mode === "history",
  });
}

/** Fetches activity history rows and converts each row to the `Activity` wrapper class via `select`. */
export function useActivityHistoryEntries(
  filter: HistoryFilter,
): UseQueryResult<Activity[], Error> {
  return useQuery({
    queryKey: historyQueryKeys.activity(filter),
    queryFn: () => historyApi.getActivityHistory(filter),
    enabled: filter.mode === "history",
    select: (rows) => rows.map((r) => Activity.fromJson(r)),
  });
}

/** Fetches aggregated most-used note scores for the given filter; gated on `filter.mode === "most_used"`. Returns the raw `ActivityScoreReply[]` wire shape. */
export function useMostUsedActivity(
  filter: HistoryFilter,
): UseQueryResult<ActivityScoreReply[], Error> {
  return useQuery({
    queryKey: historyQueryKeys.mostUsed(filter),
    queryFn: () => historyApi.getMostUsed(filter),
    enabled: filter.mode === "most_used",
  });
}

/** Fetches aggregated most-used note scores and converts each row to the `ActivityScore` wrapper class via `select`. */
export function useMostUsedActivityEntries(
  filter: HistoryFilter,
): UseQueryResult<ActivityScore[], Error> {
  return useQuery({
    queryKey: historyQueryKeys.mostUsed(filter),
    queryFn: () => historyApi.getMostUsed(filter),
    enabled: filter.mode === "most_used",
    select: (rows) => rows.map((r) => ActivityScore.fromJson(r)),
  });
}
