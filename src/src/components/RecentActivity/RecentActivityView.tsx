import { Box, Stack, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import {
  formatActivityLabel,
  formatActivityTimestamp,
  getActivityKind,
  type ActivityKind,
} from "./RecentActivityFeatures";

export interface RecentActivityViewProps {
  entry: NoteVersionSummaryReply;
}

const ACTIVITY_ICONS: Record<ActivityKind, React.ReactNode> = {
  created: <AddIcon fontSize="small" color="success" />,
  edited: <EditIcon fontSize="small" color="action" />,
};

/**
 * Renders a single recent-activity entry: kind icon + label + timestamp.
 *
 * Pure view component - the label string is built by `formatActivityLabel`,
 * the timestamp by `formatActivityTimestamp`, and the kind by
 * `getActivityKind`, all of which can be unit-tested independently of the panel.
 */
export const RecentActivityView: React.FC<RecentActivityViewProps> = ({
  entry,
}) => {
  const kind = getActivityKind(entry);

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
      <Box sx={{ pt: 0.25 }}>{ACTIVITY_ICONS[kind]}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {formatActivityLabel(entry)}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {formatActivityTimestamp(entry.created_at)}
        </Typography>
      </Box>
    </Stack>
  );
};
