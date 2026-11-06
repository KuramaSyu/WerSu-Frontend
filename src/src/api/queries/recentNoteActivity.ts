import { useMemo } from "react";
import type { HistoryFilter } from "../models/history";
import { useActivityHistory } from "./historyQueries";

/**
 * Activity kinds that count as "using" a note. Both viewing and editing
 * should bump a note in the recent / last-used lists, otherwise notes
 * the user only read never surface.
 */
export const RECENT_NOTE_ACTIONS = ["note_viewed", "note_edited"] as const;

/** How many recent activity rows to read when ranking notes. */
const DEFAULT_LIMIT = 200;

/**
 * Most recent interaction time (ms since epoch) for each note, keyed by
 * note id, across views and edits. Returns an empty map until the first
 * page of history loads.
 */
export function useRecentNoteActivityOrder(
  limit: number = DEFAULT_LIMIT,
): ReadonlyMap<string, number> {
  const filter = useMemo<HistoryFilter>(
    () => ({
      mode: "history",
      actions: [...RECENT_NOTE_ACTIONS],
      limit,
    }),
    [limit],
  );

  const { data } = useActivityHistory(filter);

  return useMemo(() => {
    const order = new Map<string, number>();
    for (const row of data ?? []) {
      if (!row.note_id) continue;
      const at = new Date(row.at).getTime();
      if (!Number.isFinite(at)) continue;
      const previous = order.get(row.note_id);
      if (previous === undefined || at > previous) {
        order.set(row.note_id, at);
      }
    }
    return order;
  }, [data]);
}

/**
 * Recency stamp for a note: the later of its last view/edit interaction
 * and its `updated_at`. Used both to rank lists and to label rows, so a
 * note the user just read outranks an older edit.
 */
export function noteRecencyStamp(
  note: { id: string; updated_at?: string },
  activityOrder?: ReadonlyMap<string, number>,
): number {
  const updated = note.updated_at ? new Date(note.updated_at).getTime() : NaN;
  const activity = activityOrder?.get(note.id);
  const candidates = [updated, activity].filter(
    (value): value is number => value !== undefined && Number.isFinite(value),
  );
  return candidates.length > 0 ? Math.max(...candidates) : -Infinity;
}

/**
 * Returns a copy of `notes` sorted newest-interaction first, counting
 * both views and edits (falling back to `updated_at`).
 */
export function orderNotesByRecency<
  T extends { id: string; updated_at?: string },
>(notes: T[], activityOrder?: ReadonlyMap<string, number>): T[] {
  return [...notes].sort(
    (a, b) =>
      noteRecencyStamp(b, activityOrder) - noteRecencyStamp(a, activityOrder),
  );
}
