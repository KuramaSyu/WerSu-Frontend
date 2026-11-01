import type { MinimalNote } from "../../api/models/search";

/**
 * Pure helpers for the Home greeting. Kept in a non-component module so
 * the React Fast Refresh rule (components-only exports) stays happy and
 * the date logic stays unit-testable.
 */

/** Time-of-day greeting for a 0-23 hour clock. */
export const getGreeting = (hour: number): string => {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

/**
 * Counts notes whose `updated_at` falls on the same local calendar day
 * as `now`.
 *
 * Note: this only sees the notes passed in. Callers should hand over the
 * recent-notes list; if a user edits more notes today than that list
 * holds, the count under-reports. That is an accepted trade-off for
 * avoiding a dedicated stats endpoint.
 */
export const countNotesEditedToday = (
  notes: MinimalNote[] | undefined,
  now: Date = new Date(),
): number => {
  if (!notes || notes.length === 0) {
    return 0;
  }
  const today = now.toDateString();
  return notes.filter(
    (note) => new Date(note.updated_at).toDateString() === today,
  ).length;
};
