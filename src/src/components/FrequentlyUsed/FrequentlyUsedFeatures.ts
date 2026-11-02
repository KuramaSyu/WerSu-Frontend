import { useMemo } from "react";
import type { HistoryFilter } from "../../api/models/history";
import {
  useActivityHistory,
  useMostUsedActivity,
} from "../../api/queries/historyQueries";
import {
  extractNoteMetadata,
  type HistoryRowEntry,
  type HistoryState,
} from "../RecentActivity/HistoryRowFeatures";
import { crumble } from "../../utils/stringCrumbler";
import { markdownPreview } from "../../utils/markdownPreview";

/** Cap on the description preview rendered per frequently-used row. */
const FREQUENTLY_USED_DESCRIPTION_CAP = 120;

/** Filter knobs accepted by `useFrequentlyUsedRows`. */
export interface FrequentlyUsedRowsOptions {
  /** Page size handed to the backend. */
  limit?: number;
  /** Scoring algorithm the backend aggregates with. */
  algorithm?: HistoryFilter["algorithm"];
  /** Only count activity within this many days. Omit for all time. */
  days?: number;
  /** Count at most one hit per note per day. */
  uniquePerDay?: boolean;
  /** Restrict to notes in any of these directories (backend-expanded). */
  directoryIds?: string[];
}

/** Fetches aggregated most-used rows for the Frequently Used panel; copies title and a 120-char description preview into each row. */
export function useFrequentlyUsedRows(
  options: FrequentlyUsedRowsOptions = {},
): HistoryState {
  const {
    limit = 8,
    algorithm = "MOST_USED_ALGORITHM_LOG_COUNT",
    days,
    uniquePerDay,
    directoryIds,
  } = options;

  const directoryKey = directoryIds?.join(",") ?? "";

  const filter = useMemo<HistoryFilter>(
    () => ({
      mode: "most_used",
      limit,
      algorithm,
      ...(days !== undefined ? { days } : {}),
      ...(uniquePerDay !== undefined ? { unique_per_day: uniquePerDay } : {}),
      ...(directoryIds && directoryIds.length > 0
        ? { directory_ids: directoryIds }
        : {}),
    }),
    // directoryKey captures the array contents for memo stability.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [limit, algorithm, days, uniquePerDay, directoryKey],
  );

  const result = useMostUsedActivity(filter);

  // Map wire shape into shared HistoryRowEntry. Markdown strip + crumble enforce the 120-char cap.
  const rows: HistoryRowEntry[] = (result.data ?? []).map((r) => {
    const description = r.stripped_content
      ? (crumble(
          markdownPreview(r.stripped_content, {
            maxLength: FREQUENTLY_USED_DESCRIPTION_CAP,
          }),
          FREQUENTLY_USED_DESCRIPTION_CAP,
        )[0] ?? "")
      : "";
    return {
      note_id: r.note_id,
      score: r.score,
      title: r.title,
      description,
    };
  });

  return {
    rows,
    isLoading: result.isLoading,
    hasError: result.isError,
  };
}

/** Fetches the most recent note_viewed activity rows for the Last Used panel. Lifts title / description from metadata_json. */
export function useLastUsedRows(
  limit: number = 3,
  days: number = 30,
): HistoryState {
  const filter = useMemo<HistoryFilter>(
    () => ({
      mode: "history",
      actions: ["note_viewed"],
      limit,
      days,
    }),
    [limit, days],
  );

  const result = useActivityHistory(filter);

  // ActivityReply rows are a superset of HistoryRowEntry; lift title/description from metadata_json.
  const rawRows: HistoryRowEntry[] = (result.data ?? []).map((row) => {
    const { title, description } = extractNoteMetadata(row);
    return {
      ...row,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    };
  });

  // Collapse duplicates by note_id (newest-first, so the first occurrence per id wins).
  // Over-fetch on the wire so the visible list stays at limit entries after dedupe.
  const seen = new Set<string>();
  const rows: HistoryRowEntry[] = [];
  for (const row of rawRows) {
    if (seen.has(row.note_id)) continue;
    seen.add(row.note_id);
    rows.push(row);
    if (rows.length >= limit) break;
  }

  return {
    rows,
    isLoading: result.isLoading,
    hasError: result.isError,
  };
}
