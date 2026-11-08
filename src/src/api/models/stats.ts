/**
 * Wire types for the precomputed user-stats endpoints.
 *
 * The backend refreshes these rows on a daily background job, so the values
 * are snapshots rather than live counts. Reads are cheap and read-only:
 *
 *   - `GET /api/stats`             — the authenticated caller's stats.
 *   - `GET /api/stats/{user_id}`   — another user's stats (admin only).
 */

/** Precomputed per-user statistics returned by `/api/stats`. */
export interface CalculatedStatsReply {
  /** User the row belongs to. */
  user_id: string;
  /** Sum of character counts over every note the user can view. */
  total_chars: number;
  /** Number of notes the user can view. */
  total_notes: number;
  /** Visible directories with at least one parent (non-upper dirs). */
  total_chapters: number;
  /** Visible directories without a parent (upper / top-level dirs). */
  total_books: number;
  /** When the row was last recomputed, in ISO 8601 format. */
  calculated_at?: string;
}
