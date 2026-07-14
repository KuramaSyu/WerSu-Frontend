import { useMemo } from "react";
import type { HistoryFilter } from "../../api/models/history";
import { useMostUsedActivity } from "../../api/queries/historyQueries";
import type {
  HistoryRowEntry,
  HistoryState,
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
