export interface NoteVersionSummaryReply {
  author_id: string;
  created_at: string;
  is_snapshot: boolean;
  note_id: string;
  snapshot_id: string;
  version_id: string;
  version_index: number;
}
