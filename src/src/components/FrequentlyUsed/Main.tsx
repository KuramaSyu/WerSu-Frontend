import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useFrequentlyUsedRows,
  useLastUsedRows,
} from "./FrequentlyUsedFeatures";
import type { HistoryRowEntry } from "../RecentActivity/HistoryRowFeatures";
import { formatHistoryRowTimestamp } from "../RecentActivity/HistoryRowFeatures";
import type { MostUsedAlgorithm } from "../../api/models/history";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import {
  HistoryListPanel,
  IconTitleSubtitleRow,
} from "../Panels/HistoryListPanel";
import { CopyNameMenu } from "../RightClick/CopyNameMenu";

/**
 * Props for the FrequentlyUsedPanel component.
 */
export interface FrequentlyUsedPanelProps {
  /** Optional title override. */
  title?: string | null;
  /** Max number of items to fetch and render. */
  limit?: number;
  /** Scoring algorithm the backend aggregates with. */
  algorithm?: MostUsedAlgorithm;
  /** Only count activity within this many days. Omit for all time. */
  days?: number;
}

/**
 * Props for the LastUsedPanel component.
 */
export interface LastUsedPanelProps {
  /** Optional title override. */
  title?: string | null;
  /** Max number of items to fetch and render. */
  limit?: number;
  /** Time window the backend uses to scope the activity log. */
  days?: number;
}

/** Generic panel that shows frequently used notes.
 *  Data fetching via useFrequentlyUsedRows; rows rendered by IconTitleSubtitleRow with title + description subtitle, no icon. */
export const FrequentlyUsedPanel: React.FC<FrequentlyUsedPanelProps> = ({
  title = "Frequently used",
  limit = 20,
  algorithm = "MOST_USED_ALGORITHM_LOG_COUNT",
  days,
}) => {
  const { rows, isLoading, hasError } = useFrequentlyUsedRows({
    limit,
    algorithm,
    days,
  });
  const navigate = useNavigate();
  const developerMode = useFeatureStore(
    (state) => state.flags[FeatureFlagName.DeveloperMode],
  );

  return (
    <HistoryListPanel
      title={title}
      rows={rows}
      isLoading={isLoading}
      hasError={hasError}
      loadingText="Loading frequently used notes..."
      errorText="Failed to load frequently used notes."
      emptyText="No frequently used notes yet."
      spacing={0.25}
      renderRow={(entry, index) => {
        const e = entry as HistoryRowEntry;
        return (
          <CopyNameMenu
            text={e.title ?? ""}
            targetId={e.note_id}
            note={
              e.note_id && !e.action?.startsWith("directory_")
                ? { id: e.note_id, title: e.title ?? "" }
                : undefined
            }
          >
            <IconTitleSubtitleRow
              title={e.title ?? ""}
              subtitle={e.description ?? undefined}
              onClick={() => navigate(`/n/${e.note_id}`)}
              developerDebug={developerMode ? JSON.stringify(e) : undefined}
              sx={{
                backgroundColor:
                  index % 2 === 1 ? "background.default" : "transparent",
              }}
            />
          </CopyNameMenu>
        );
      }}
    />
  );
};

/** Shows the most recently used notes, counting both views and edits.
 *  Defaults to the last 3 unique notes. Duplicates collapsed by note_id. Rows have no icon (flush left padding). */
export const LastUsedPanel: React.FC<LastUsedPanelProps> = ({
  title = "Last used",
  limit = 3,
  days = 30,
}) => {
  // fetch more then limit, since last used often contains duplicates
  const { rows, isLoading, hasError } = useLastUsedRows(limit * 3, days);

  // dedupe by note_id and trim to limit
  const rows_filter = useMemo<HistoryRowEntry[]>(() => {
    const selected = new Array<HistoryRowEntry>();
    for (const row of rows) {
      if (selected.find((r) => r.note_id === row.note_id)) {
        continue;
      }
      selected.push(row);
      if (selected.length >= limit) {
        break;
      }
    }
    return selected;
  }, [rows, limit]);

  const navigate = useNavigate();
  const developerMode = useFeatureStore(
    (state) => state.flags[FeatureFlagName.DeveloperMode],
  );

  return (
    <HistoryListPanel
      title={title}
      rows={rows_filter}
      isLoading={isLoading}
      hasError={hasError}
      loadingText="Loading last used notes..."
      errorText="Failed to load last used notes."
      emptyText="No recently viewed notes yet."
      spacing={0.25}
      renderRow={(entry, index) => {
        const e = entry as HistoryRowEntry;
        const key = e.id ?? e.note_id;
        return (
          <CopyNameMenu
            key={key}
            text={e.title ?? ""}
            targetId={e.note_id}
            note={
              e.note_id && !e.action?.startsWith("directory_")
                ? { id: e.note_id, title: e.title ?? "" }
                : undefined
            }
          >
            <IconTitleSubtitleRow
              title={e.title ?? ""}
              subtitle={e.at ? formatHistoryRowTimestamp(e.at) : undefined}
              onClick={() => navigate(`/n/${e.note_id}`)}
              developerDebug={developerMode ? JSON.stringify(e) : undefined}
              sx={{
                backgroundColor:
                  index % 2 === 1 ? "background.default" : "transparent",
              }}
            />
          </CopyNameMenu>
        );
      }}
    />
  );
};
