import { Box, Divider, Stack, Typography } from "@mui/material";
import { M3 } from "../../statics";
import {
  useRecentActivityFeatures,
  type ActivityTarget,
} from "./RecentActivityFeatures";
import { RecentActivityView } from "./RecentActivityView";
import { useThemeStore } from "../../zustand/useThemeStore";

/**
 * Props for the RecentActivityPanel component.
 */
export interface RecentActivityPanelProps {
  /** Target entity to fetch activity for. */
  target: ActivityTarget;
  /** Optional title override. */
  title?: string;
  /** Max number of items to fetch and render. */
  limit?: number;
  /** Directory recursion depth for directory/root queries. */
  maxDepth?: number;
}

/**
 * Generic panel that shows recent note-version activity for a note/directory.
 *
 * Data loading is owned by `useRecentActivityFeatures`; each row is rendered
 * by `RecentActivityView`.
 */
export const RecentActivityPanel: React.FC<RecentActivityPanelProps> = ({
  target,
  title = "Recent activity",
  limit = 8,
  maxDepth = 3,
}) => {
  const { activity, isLoading, hasError } = useRecentActivityFeatures(
    target,
    limit,
    maxDepth,
  );
  const { theme } = useThemeStore();

  return (
    <Box sx={{ color: theme.palette.text.secondary }}>
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
      {!isLoading && !hasError && activity.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          No recent activity.
        </Typography>
      )}
      <Stack spacing={theme.spacing(2)}>
        {activity.map((entry) => (
          <RecentActivityView key={entry.version_id} entry={entry} />
        ))}
      </Stack>
    </Box>
  );
};
