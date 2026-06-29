// ---------------------------------------------------------------------------
// NoteEditor / PublicNoteEditor
//
// Thin wrappers that pick a collaboration hook and forward its
// `{ ydoc, provider }` to the collab-agnostic `NoteEditorCore`.
// `NoteEditorCore` lives in `./NoteEditorCore.tsx` and is also re-
// exported below for callers that want to drive the core directly.
//
// `markdownToProsemirror` and `imageLinkToBlock` are re-exported from
// the core file as well — `editorStore.ts` and other call sites still
// import them from `./Editor`.
// ---------------------------------------------------------------------------

import type React from "react";
import { useNoteCollaboration } from "../../hooks/useNoteCollaboration";
import { usePublicNoteCollaboration } from "../../hooks/usePublicNoteCollaboration";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import {
  NoteEditorCore,
  type NoteEditorProps,
  type AppLayoutProps,
  markdownToProsemirror,
  imageLinkToBlock,
} from "./NoteEditorCore";

export { NoteEditorCore, markdownToProsemirror, imageLinkToBlock };
export type { NoteEditorProps, AppLayoutProps };

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
