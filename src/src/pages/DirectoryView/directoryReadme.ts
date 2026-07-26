import type { MinimalNote } from "../../api/models/search";

/**
 * Strip the leading README entry from a notes array.
 * `slice(1)` on an empty array is already `[]`, so no extra guard needed.
 */
export const visibleNotes = (notes: MinimalNote[]): MinimalNote[] =>
  notes.slice(1);

/**
 * Number of user-visible notes for a directory, given its `child_note_ids`.
 * Treats the first id as the README and skips it when present.
 */
export const visibleNoteCount = (ids: readonly string[] | undefined): number =>
  Math.max(0, (ids?.length ?? 0) - 1);
