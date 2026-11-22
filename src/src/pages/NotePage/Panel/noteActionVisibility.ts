/**
 * Which actions the note toolbar should expose for the current viewer.
 *
 * Kept pure and free of React/MUI imports so the rules -- especially
 * "public viewers never see Share" -- are testable without mounting
 * the editor/dialog graph.
 */
export interface NoteActionVisibility {
  /**
   * Save is available whenever the session can write. Unlike editing,
   * ticking a task checkbox in view mode also creates unsaved changes,
   * so the control must remain reachable without entering edit mode.
   */
  showSave: boolean;
  /** Share is for note owners only -- never for public viewers. */
  showShare: boolean;
  /** Delete is for owners on a writable session only. */
  showDelete: boolean;
}

export const getNoteActionVisibility = ({
  isPublic,
  readOnly,
}: {
  isPublic: boolean;
  readOnly: boolean;
  /** Retained for callers that share this rule set; Save no longer depends on it. */
  editMode: boolean;
}): NoteActionVisibility => ({
  showSave: !readOnly,
  showShare: !isPublic,
  showDelete: !readOnly && !isPublic,
});
