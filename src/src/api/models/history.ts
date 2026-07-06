/**
 * Domain types for the `GET /api/history` endpoint.
 *
 * Mirrors the Go `ActivityController` and the proto
 * `ActivityStatisticsService` it wraps. The wire shape uses
 * uppercase enum values (matches the proto enum names) so the
 * TS types here align directly with what the backend emits.
 *
 * Two response shapes live behind the same endpoint, selected via
 * the `mode` query parameter:
 *   - `mode=history` (default)  -> `ActivityReply[]`
 *   - `mode=most_used`           -> `ActivityScoreReply[]`
 */

/**
 * Mirrors the proto `AccessedAs` enum. The values are spelled the
 * same as the Go controller's `enums:"..."` form-tag validation.
 */
export type AccessedAs =
  | "ACCESSED_AS_UNSPECIFIED"
  | "ACCESSED_AS_USER"
  | "ACCESSED_AS_SYSTEM";

/** Mirrors the proto `MostUsedAlgorithm` enum. */
export type MostUsedAlgorithm =
  | "MOST_USED_ALGORITHM_UNSPECIFIED"
  | "MOST_USED_ALGORITHM_COUNT"
  | "MOST_USED_ALGORITHM_LOG_COUNT";

/** Selects which response shape `/api/history` returns. */
export type HistoryMode = "history" | "most_used";

/**
 * One row of the activity log. The action prefix determines which
 * of `note_id` / `directory_id` / `role_id` is populated (the
 * backend enforces exactly one).
 */
export type ActivityKind =
  | "note_viewed"
  | "note_created"
  | "note_edited"
  | "note_deleted"
  | "note_published"
  | "note_shared"
  | "note_unshared"
  | "note_restored"
  | "note_archived"
  | "note_version_restored"
  | "note_attachment_added"
  | "directory_created"
  | "directory_viewed"
  | "directory_edited"
  | "directory_deleted"
  | "role_grant"
  | "role_revoke"
  | "role_change";

/**
 * REST representation of a single row from the activity log.
 *
 * Mirrors Go's `ActivityReply`. `at` is an RFC3339 string (Go's
 * `time.Time` JSON-encodes to RFC3339 by default); `metadata_json`
 * is a JSON-encoded payload (the backend stores JSONB, but exposes
 * it as a string here so clients don't need a JSONB parser).
 */
export interface ActivityReply {
  id: string;
  actor_id: string;
  accessed_as: AccessedAs;
  action: ActivityKind;
  note_id: string;
  directory_id: string;
  role_id: string;
  /** RFC3339 timestamp from the backend (e.g. `2026-07-06T12:34:56Z`). */
  at: string;
  /** JSON-encoded action-specific payload as a string. */
  metadata_json: string;
}

/**
 * REST representation of an aggregated `(note_id, score)` row from
 * the `most_used` mode. `score` is whatever the chosen algorithm
 * computed (raw count or log-flattened count).
 */
export interface ActivityScoreReply {
  note_id: string;
  score: number;
}

/**
 * Bag of query parameters for `GET /api/history`.
 *
 * Every field is optional. Omitting a field means "do not filter on
 * this column" (the gRPC layer treats zero-values as no-filter).
 * `mode` is the only required field at runtime; the builder's
 * `build()` enforces that.
 */
export interface HistoryFilter {
  mode?: HistoryMode;
  note_id?: string;
  directory_id?: string;
  actor_id?: string;
  role_id?: string;
  accessed_as?: AccessedAs;
  actions?: ActivityKind[];
  days?: number;
  limit?: number;
  offset?: number;
  unique_per_day?: boolean;
  algorithm?: MostUsedAlgorithm;
}
