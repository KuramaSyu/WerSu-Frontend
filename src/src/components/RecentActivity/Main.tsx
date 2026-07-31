import { Box, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  useHistoryRows,
  type HistoryRowEntry,
  type HistoryTarget,
} from "./HistoryRowFeatures";

import { useThemeStore } from "../../zustand/useThemeStore";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import { HistoryRowView } from "./HistoryRowView";

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
  /**
   * Time window the backend uses to scope the activity log
   * (`days` parameter on `/api/history`). Mirrors the previous
   * `maxDepth` knob at the panel level but lives one layer down.
   */
  days?: number;
}

/**
 * Generic panel that shows recent activity for a note/directory.
 *
 * Data loading is owned by `useHistoryRows` (which wraps the
 * `/api/history` `mode=history` TanStack Query hook); each row is
 * rendered by `HistoryRowView`. The same component will power the
 * upcoming Frequently Used panel -- there it will be fed from the
 * `mode=most_used` sibling hook instead.
 */
export const RecentActivityPanel: React.FC<RecentActivityPanelProps> = ({
  target,
  title = "Recent activity",
  limit = 8,
  days = 30,
}) => {
  const { rows, isLoading, hasError } = useHistoryRows(target, limit, days);
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const developerMode = useFeatureStore(
    (state) => state.flags[FeatureFlagName.DeveloperMode],
  );

  // Hide rows that carry a `score` here -- those are the
  // most-used variant and belong to the upcoming Frequently Used
  // panel. The `score` field still exists on `HistoryRowEntry`,
  // and the chip / flame icon branch in `HistoryRowView` is still
  // reachable for callers that build rows from `mode=most_used`
  // themselves.
  const recentRows = rows.filter((r) => r.score === undefined);

  // when clicking, reroute to /n/<note_id>
  const handleItemClick = (entry: HistoryRowEntry) => {
    navigate(`/n/${entry.note_id}`);
  };

  return (
    <Box sx={{ color: theme.palette.text.secondary }}>
      {title && (
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, mb: theme.spacing(1) }}
        >
          {title}
        </Typography>
      )}
      {isLoading && (
        <Typography variant="body2" color="textSecondary">
          Loading activity...
        </Typography>
      )}
      {hasError && !isLoading && (
        <Typography variant="body2" color="error">
          Failed to load activity.
        </Typography>
      )}
      {!isLoading && !hasError && recentRows.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          No recent activity.
        </Typography>
      )}
      <Stack spacing={1}>
        {recentRows.map((entry) => (
          <HistoryRowView
            key={entry.id ?? entry.note_id}
            entry={entry}
            onClick={handleItemClick}
            developerMode={developerMode}
          />
        ))}
      </Stack>
    </Box>
  );
};
