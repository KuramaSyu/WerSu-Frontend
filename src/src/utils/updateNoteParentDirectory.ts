import type { Note } from "../api/models/search";

/**
 * Replaces a note's parent directory set, keeping the cache in sync
 * with the upcoming `PATCH /api/notes` call.
 *
 * `undefined` clears every parent so the note lives at the root.
 * Otherwise the note's `directory_ids` becomes `[directoryId]` — the
 * single-parent shape used by the drag-and-drop and side-panel flows.
 *
 * Mutates `note` for the existing call sites that read it back through
 * TanStack's query snapshot; the return value mirrors that.
 */
export function updateNoteParentDirectory(
  note: Note,
  directoryId?: string,
): Note {
  if (!directoryId) {
    note.directory_ids = [];
    return note;
  }

  const alreadyHasThisParent = (note.directory_ids ?? []).includes(directoryId);

  if (alreadyHasThisParent) {
    return note;
  }

  note.directory_ids = [directoryId];
  return note;
}
