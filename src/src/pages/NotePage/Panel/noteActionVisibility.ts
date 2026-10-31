/**
 * Which actions the note toolbar should expose for the current viewer.
 *
 * Kept pure and free of React/MUI imports so the rules -- especially
 * "public viewers never see Share" -- are testable without mounting
 * the editor/dialog graph.
 */
export interface NoteActionVisibility {
  /** Save only appears while editing a writable session. */
  showSave: boolean;
  /** Share is for note owners only -- never for public viewers. */
  showShare: boolean;
  /** Delete is for owners on a writable session only. */
  showDelete: boolean;
}

export const getNoteActionVisibility = ({
  isPublic,
  readOnly,
  editMode,
}: {
  isPublic: boolean;
  readOnly: boolean;
  editMode: boolean;
}): NoteActionVisibility => ({
  showSave: !readOnly && editMode,
  showShare: !isPublic,
  showDelete: !readOnly && !isPublic,
});
