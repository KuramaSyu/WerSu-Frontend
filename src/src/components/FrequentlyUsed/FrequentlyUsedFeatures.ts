import { useMemo } from "react";
import type { HistoryFilter } from "../../api/models/history";
import { useMostUsedActivity } from "../../api/queries/historyQueries";
import type {
  HistoryRowEntry,
  HistoryState,
} from "../RecentActivity/HistoryRowFeatures";

/**
 * Fetches aggregated most-used rows for the Frequently Used panel.
 *
 * Mirrors `useHistoryRows` but hits the `mode=most_used` variant of
 * `/api/history` and returns each row with its `score` populated.
 * The view layer (`HistoryRowView`) renders the score chip and
 * flame icon automatically when `score` is set.
 *
 * Pagination/policy:
 * - `limit` controls how many rows the panel shows; defaults to 8
 *   to match `RecentActivityPanel`.
 * - `algorithm` defaults to the backend's default
 *   (`MOST_USED_ALGORITHM_COUNT`) -- callers can override per panel.
 */
export function useFrequentlyUsedRows(
  limit: number = 8,
  algorithm: HistoryFilter["algorithm"] = "MOST_USED_ALGORITHM_COUNT",
): HistoryState {
  const filter = useMemo<HistoryFilter>(
    () => ({
      mode: "most_used",
      limit,
      algorithm,
    }),
    [limit, algorithm],
  );

  const result = useMostUsedActivity(filter);

  // `ActivityScoreReply` rows have { note_id, score }; map them
  // into the shared `HistoryRowEntry` shape so the view is reused
  // without changes.
  const rows: HistoryRowEntry[] = (result.data ?? []).map((r) => ({
    note_id: r.note_id,
    score: r.score,
  }));

  return {
    rows,
    isLoading: result.isLoading,
    hasError: result.isError,
  };
}
