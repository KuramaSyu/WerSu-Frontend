import { Box, Divider, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { ActivityApi } from "../api/ActivityApi";
import type { NoteVersionSummaryReply } from "../api/models/activity";
import { M3 } from "../statics";
import { useNotesStore } from "../zustand/useNotesStore";
import { useSearchNotesStore } from "../zustand/useSearchNotesStore";

/**
 * Defines which entity's activity should be loaded for the panel.
 */
export type ActivityTarget =
  | { type: "note"; id: string }
  | { type: "directory"; id: string }
  | { type: "root" };

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

/** Formats ISO timestamps into a human-friendly string. */
const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

/** Builds the label for an activity entry. */
const formatActivityLabel = (activity: NoteVersionSummaryReply): string => {
  const note = useSearchNotesStore
    .getState()
    .notes.find((n) => n.id === activity.note_id);
  const v = activity.version_index;
  // if (activity.is_snapshot) {
  //   return `Created snapshot of ${note?.title || activity.note_id}`;
  //   return `Snapshot v${activity.version_index}`;
  // }
  // return `Edited ${note?.title || activity.note_id}`;
  // return `Edit v${activity.version_index}`;
  return (
    (v == 1 ? `Created ` : ``) +
    `${note?.title || activity.note_id} ` +
    (v > 1 ? `(v${v})` : "")
  );
};

/**
 * Generic panel that shows recent note-version activity for a note/directory.
 */
export const RecentActivityPanel: React.FC<RecentActivityPanelProps> = ({
  target,
  title = "Recent activity",
  limit = 8,
  maxDepth = 3,
}) => {
  // Keep API instance stable to avoid unnecessary effect re-runs.
  const api = useMemo(() => new ActivityApi(), []);
  // Use a stable key so identical targets don't re-trigger the fetch effect
  // when parent re-renders (e.g., hover or focus state changes).
  const targetKey = useMemo(
    () => `${target.type}:${"id" in target ? target.id : "root"}`,
    [target],
  );
  const [activity, setActivity] = useState<NoteVersionSummaryReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchActivity = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        let data: NoteVersionSummaryReply[] = [];
        if (target.type === "note") {
          // Note activity: versions list.
          data = await api.getNoteActivity(target.id, limit, 0);
        } else if (target.type === "directory") {
          // Directory activity: include descendants up to maxDepth.
          data = await api.getDirectoryActivityById(target.id, {
            limit,
            offset: 0,
            max_depth: maxDepth,
            directory_id: target.id,
          });
        } else {
          // Root activity: global directory activity endpoint.
          data = await api.getDirectoryActivity({
            limit,
            offset: 0,
            max_depth: maxDepth,
          });
        }

        if (!isMounted) {
          return;
        }

        // Update state with the newest activity list.
        setActivity(data);
      } catch (error) {
        console.error("Failed to load activity", error);
        if (!isMounted) {
          return;
        }
        setHasError(true);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchActivity();

    return () => {
      isMounted = false;
    };
  }, [api, targetKey, limit, maxDepth]);

  return (
    <Box sx={{ px: 2, py: 2 }}>
      <Stack spacing={M3}>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Divider />
        {isLoading && (
          <Typography variant="body2" color="text.secondary">
            Loading activity...
          </Typography>
        )}
        {hasError && !isLoading && (
          <Typography variant="body2" color="error">
            Failed to load activity.
          </Typography>
        )}
        {!isLoading && !hasError && activity.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No recent activity.
          </Typography>
        )}
        <Stack spacing={1.5}>
          {activity.map((entry) => (
            <Box key={entry.version_id}>
              <Typography variant="body2" fontWeight={600}>
                {formatActivityLabel(entry)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatTimestamp(entry.created_at)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};
