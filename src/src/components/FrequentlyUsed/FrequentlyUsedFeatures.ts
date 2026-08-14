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

/** Fetches aggregated most-used rows for the Frequently Used panel; copies `title` and a 120-char `description` preview into each row. */
export function useFrequentlyUsedRows(
  limit: number = 8,
  algorithm: HistoryFilter["algorithm"] = "MOST_USED_ALGORITHM_LOG_COUNT",
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

  // Map wire shape into the shared `HistoryRowEntry`. Markdown stripping
  // runs first so table pipes, bold/italic markers etc. don't reach the
  // row preview; `crumble` then enforces the 120-char display cap.
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

/** Fetches the most recent `note_viewed` activity rows for the Last Used panel. Lifts `title` / `description` from `metadata_json` so the view doesn't have to parse JSON. */
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

  // `ActivityReply` rows are a structural superset of `HistoryRowEntry`;
  // lift title/description from metadata_json so the row view doesn't
  // re-parse the metadata on every render.
  const rawRows: HistoryRowEntry[] = (result.data ?? []).map((row) => {
    const { title, description } = extractNoteMetadata(row);
    return {
      ...row,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    };
  });

  // Collapse duplicates by `note_id` so re-viewing the same note doesn't
  // push other recently-viewed notes out of the list. The backend
  // returns rows newest-first, so the first occurrence per id is the
  // most recent event for that note. We over-fetch on the wire (a
  // multiple of `limit`) to keep the visible list at `limit` entries
  // even after dedupe trims duplicates.
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
