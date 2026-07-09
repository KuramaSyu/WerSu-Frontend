// Domain types for the `GET /api/history` endpoint; mirrors the Go `ActivityController` and the proto `ActivityStatisticsService` it wraps.

import type { MinimalNote } from "./search";

/** Mirrors the proto `AccessedAs` enum (matches the Go controller's `enums:` validation). */
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

/** One row of the activity log; the action prefix determines which of `note_id`/`directory_id`/`role_id` is populated. */
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

/** REST representation of a single row from the activity log (Go's `ActivityReply`). */
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

/** REST representation of an aggregated `(note_id, score)` row from `most_used` mode; `title` and `stripped_content` are omitted when empty. */
export interface ActivityScoreReply {
  note_id: string;
  score: number;
  /** Note title; omitted when the backend has no title to report. */
  title?: string;
  /** Note preview; omitted when the backend has no preview. */
  stripped_content?: string;
}

/** Bag of query parameters for `GET /api/history`; omitting a field means "do not filter on this column". */
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

/** Subset of `ActivityReply.metadata_json` populated when the activity targets a note. */
export interface ActivityNoteMetadata {
  note_title?: string;
  note_content?: string;
}

/** Wrapper class for `ActivityReply`; exposes `is_note()` and `get_note()` helpers for note events. */
export class Activity implements ActivityReply {
  id: string;
  actor_id: string;
  accessed_as: AccessedAs;
  action: ActivityKind;
  note_id: string;
  directory_id: string;
  role_id: string;
  at: string;
  metadata_json: string;

  constructor(data: ActivityReply) {
    this.id = data.id;
    this.actor_id = data.actor_id;
    this.accessed_as = data.accessed_as;
    this.action = data.action;
    this.note_id = data.note_id;
    this.directory_id = data.directory_id;
    this.role_id = data.role_id;
    this.at = data.at;
    this.metadata_json = data.metadata_json;
  }

  static fromJson(data: ActivityReply): Activity {
    return new Activity(data);
  }

  /** `true` when the activity targets a note (mirrors the `note_` prefix on `ActivityKind`). */
  is_note(): boolean {
    return this.action.startsWith("note_");
  }

  /** Returns a `MinimalNote` view of the referenced note, or `undefined` for non-note events / malformed JSON / missing fields. */
  get_note(): MinimalNote | undefined {
    if (!this.is_note()) {
      return undefined;
    }
    let parsed: ActivityNoteMetadata;
    try {
      parsed = JSON.parse(this.metadata_json) as ActivityNoteMetadata;
    } catch {
      return undefined;
    }
    const title = parsed.note_title;
    const content = parsed.note_content;
    if (title === undefined || content === undefined) {
      return undefined;
    }
    return {
      id: this.note_id,
      title,
      author_id: "",
      updated_at: "",
      stripped_content: content,
    };
  }
}

/** Wrapper class for `ActivityScoreReply`; exposes `get_note()` which builds a `MinimalNote` from the embedded fields. */
export class ActivityScore implements ActivityScoreReply {
  note_id: string;
  score: number;
  title?: string | undefined;
  stripped_content?: string | undefined;

  constructor(data: ActivityScoreReply) {
    this.note_id = data.note_id;
    this.score = data.score;
    this.title = data.title;
    this.stripped_content = data.stripped_content;
  }

  static fromJson(data: ActivityScoreReply): ActivityScore {
    return new ActivityScore(data);
  }

  /** Returns a `MinimalNote` view; `author_id` / `updated_at` / `permissions` are left empty/undefined (not on the wire). */
  get_note(): MinimalNote {
    return {
      id: this.note_id,
      title: this.title ?? "",
      author_id: "",
      updated_at: "",
      stripped_content: this.stripped_content ?? "",
    };
  }
}
