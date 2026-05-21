/**
 * Summary payload for a note version entry.
 * Returned by directory-activity and note-version endpoints.
 */
export interface NoteVersionSummaryReply {
  /** Author who created the version. */
  author_id: string;
  /** Creation timestamp in ISO 8601 format. */
  created_at: string;
  /** Whether this entry is a snapshot version. */
  is_snapshot: boolean;
  /** Note id the version belongs to. */
  note_id: string;
  /** Snapshot identifier (if snapshot). */
  snapshot_id: string;
  /** Unique version identifier. */
  version_id: string;
  /** Monotonic version index. */
  version_index: number;
}
