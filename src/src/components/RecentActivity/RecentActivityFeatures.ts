import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ActivityApi } from "../../api/ActivityApi";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import { queryClient } from "../../api/queryClient";
import { Note } from "../../api/models/search";

/**
 * Defines which entity's activity should be loaded for the panel.
 */
export type ActivityTarget =
  | { type: "note"; id: string }
  | { type: "directory"; id: string }
  | { type: "root" };

/**
 * Resolved activity state for the panel.
 */
export interface ActivityState {
  activity: NoteVersionSummaryReply[];
  isLoading: boolean;
  hasError: boolean;
}

/**
 * Owns the data fetching and lifecycle for the RecentActivity panel.
 *
 * Centralizes:
 * - resolving which API call to issue based on the target
 * - mounting/unmount tracking to avoid state updates after unmount
 * - exposing a stable key so identical targets don't re-trigger fetches
 */
export function useRecentActivityFeatures(
  target: ActivityTarget,
  limit = 8,
  maxDepth = 3,
): ActivityState {
  // Keep API instance stable to avoid unnecessary effect re-runs.
  const api = useMemo(() => new ActivityApi(), []);
  const [activity, setActivity] = useState<NoteVersionSummaryReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Use a stable key so identical targets don't re-trigger the fetch effect
  // when parent re-renders (e.g., hover or focus state changes).
  const targetKey = useMemo(
    () => `${target.type}:${"id" in target ? target.id : "root"}`,
    [target],
  );

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

  return { activity, isLoading, hasError };
}

/** Formats ISO timestamps into a human-friendly string. */
export const formatActivityTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatDistanceToNow(date, { addSuffix: true });
};

/** Builds the label for an activity entry. */
export const formatActivityLabel = (
  activity: NoteVersionSummaryReply,
): string => {
  const note = queryClient.getQueryData<Note>(["notes", activity.note_id]);
  const v = activity.version_index;
  return (
    (v == 1 ? `Created ` : ``) +
    `${note?.title || activity.note_id} ` +
    (v > 1 ? `(v${v})` : "")
  );
};

/**
 * Resolves the activity kind from a version summary.
 *
 * - `version_index === 1` -> "created"
 * - anything else -> "edited"
 */
export type ActivityKind = "created" | "edited";

export const getActivityKind = (
  activity: NoteVersionSummaryReply,
): ActivityKind => {
  return activity.version_index === 1 ? "created" : "edited";
};
