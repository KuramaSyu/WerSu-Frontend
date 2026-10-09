import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useHistoryRows,
  type HistoryRowEntry,
  type HistoryTarget,
  getHistoryRowMeta,
  getHistoryRowVariantLabel,
  formatHistoryRowTimestamp,
} from "./HistoryRowFeatures";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import {
  HistoryListPanel,
  IconTitleSubtitleRow,
} from "../Panels/HistoryListPanel";

/**
 * Props for the RecentActivityPanel component.
 */
export interface RecentActivityPanelProps {
  /** Target entity to fetch activity for. */
  target: HistoryTarget;
  /** Optional title override. */
  title?: string;
  /** Max number of items to fetch and render. */
  limit?: number;
  /** Time window (days parameter on /api/history). Mirrors the previous maxDepth knob at the panel level. */
  days?: number;
}

/** Generic panel that shows recent activity for a note/directory.
 *  Data via useHistoryRows; row icons from VARIANT_META so every action keeps its colour and glyph. */
export const RecentActivityPanel: React.FC<RecentActivityPanelProps> = ({
  target,
  title = "Recent activity",
  limit = 8,
  days = 30,
}) => {
  const { rows, isLoading, hasError } = useHistoryRows(target, limit, days);
  const navigate = useNavigate();
  const developerMode = useFeatureStore(
    (state) => state.flags[FeatureFlagName.DeveloperMode],
  );

  // Drop score-bearing rows (those belong to the Frequently Used panel).
  const recentRows = useMemo<HistoryRowEntry[]>(
    () => rows.filter((r) => r.score === undefined),
    [rows],
  );

  return (
    <HistoryListPanel
      title={title}
      rows={recentRows}
      isLoading={isLoading}
      hasError={hasError}
      loadingText="Loading activity..."
      errorText="Failed to load activity."
      emptyText="No recent activity."
      renderRow={(entry) => {
        const e = entry as HistoryRowEntry;
        const meta = getHistoryRowMeta(e);
        const Icon = meta.icon;
        return (
          <IconTitleSubtitleRow
            icon={<Icon fontSize="small" color={meta.color} />}
            title={getHistoryRowVariantLabel(e)}
            subtitle={e.at ? formatHistoryRowTimestamp(e.at) : undefined}
            onClick={() => navigate(`/n/${e.note_id}`)}
            iconTooltip={meta.label}
            developerDebug={developerMode ? JSON.stringify(e) : undefined}
          />
        );
      }}
    />
  );
};
