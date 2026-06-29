// ---------------------------------------------------------------------------
// NoteEditor / PublicNoteEditor
//
// Thin wrappers that pick a collaboration hook and forward its
// `{ ydoc, provider }` to the collab-agnostic `NoteEditorCore`.
//
// This file is intentionally a small barrel: it re-exports nothing.
// Callers that need the core directly should import `NoteEditorCore`
// from `./NoteEditorCore`, the format helpers from
// `./editorFormatUtils`, and the types from the same source files
// (e.g. `NoteEditorProps` from `./NoteEditorCore`). Keeping imports
// pointed at the original module instead of through this barrel
// makes the dependency graph easier to follow and avoids the
// re-export indirection that `verbatimModuleSyntax: true` makes
// awkward in some configurations.
// ---------------------------------------------------------------------------

import type React from "react";
import { useNoteCollaboration } from "../../hooks/useNoteCollaboration";
import { usePublicNoteCollaboration } from "../../hooks/usePublicNoteCollaboration";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { NoteEditorCore, type NoteEditorProps } from "./NoteEditorCore";

/**
 * Private-note editor: opens a JWT-authenticated Hocuspocus session via
 * `useNoteCollaboration`. Use this everywhere a logged-in user is
 * editing their own note.
 */
export const NoteEditor: React.FC<NoteEditorProps> = (props) => {
  const { noteId } = props;
  const { editMode } = useEditorSettings();
  const collaboration = useNoteCollaboration(editMode ? noteId : undefined);
  return (
    <NoteEditorCore
      {...props}
      ydoc={collaboration?.ydoc ?? null}
      provider={collaboration?.provider ?? null}
    />
  );
};

/**
 * Public / shared-note editor: opens a session via
 * `usePublicNoteCollaboration` (share-token auth, distinct from the
 * private collab cache). Use this for shared-note pages, embedded
 * previews, etc.
 */
export const PublicNoteEditor: React.FC<NoteEditorProps> = (props) => {
  const { noteId } = props;
  const { editMode } = useEditorSettings();
  const collaboration = usePublicNoteCollaboration(
    editMode ? noteId : undefined,
  );
  return (
    <NoteEditorCore
      {...props}
      ydoc={collaboration?.ydoc ?? null}
      provider={collaboration?.provider ?? null}
    />
  );
};
