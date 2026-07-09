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
import { useThemeStore } from "../../zustand/useThemeStore";

export interface RecentActivityViewProps {
  entry: NoteVersionSummaryReply;
  onClick: (entry: NoteVersionSummaryReply) => void;
}

const ACTIVITY_ICONS: Record<ActivityKind, React.ReactNode> = {
  created: <AddIcon fontSize="small" color="action" />,
  edited: <EditIcon fontSize="small" color="action" />,
};

/**
 * Renders a single recent-activity entry: kind icon + label + timestamp.
 */
export const RecentActivityView: React.FC<RecentActivityViewProps> = ({
  entry,
  onClick,
}) => {
  const kind = getActivityKind(entry);
  const { theme } = useThemeStore();

  return (
    <Stack
      direction="row"
      spacing={theme.spacing(1)}
      sx={{
        alignItems: "flex-start",
        cursor: "pointer",
        borderRadius: 1,
        px: 1,
        py: 0.5,
        transition: theme.transitions.create(
          ["background-color", "transform"],
          { duration: theme.transitions.duration.short },
        ),
        "&:hover": {
          backgroundColor: theme.palette.action.hover,
        },
      }}
      onClick={() => onClick(entry)}
    >
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
