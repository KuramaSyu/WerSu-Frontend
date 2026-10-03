// ---------------------------------------------------------------------------
// NoteEditor / PublicNoteEditor
// Thin wrappers that pick a collaboration hook and forward its
// { ydoc, provider } to the collab-agnostic NoteEditorCore. Memoized
// so a fresh note ref from Tanstack's useQuery does not tear down the
// editor's Tiptap instance or re-trigger provider listeners.
// ---------------------------------------------------------------------------

import { memo } from "react";
import { useNoteCollaboration } from "../../hooks/useNoteCollaboration";
import { usePublicNoteCollaboration } from "../../hooks/usePublicNoteCollaboration";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { NoteEditorCore, type NoteEditorProps } from "./NoteEditorCore";

const NoteEditorImpl: React.FC<NoteEditorProps> = (props) => {
  const { noteId } = props;
  const editMode = useEditorSettings((s) => s.editMode);
  const collaboration = useNoteCollaboration(editMode ? noteId : undefined);
  return (
    <NoteEditorCore
      {...props}
      ydoc={collaboration?.ydoc ?? null}
      provider={collaboration?.provider ?? null}
    />
  );
};

/** Private-note editor: opens a JWT-authenticated Hocuspocus session via useNoteCollaboration. */
export const NoteEditor = memo(NoteEditorImpl);

const PublicNoteEditorImpl: React.FC<NoteEditorProps> = (props) => {
  const { noteId } = props;
  const editMode = useEditorSettings((s) => s.editMode);
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

/** Public/shared-note editor: opens a session via usePublicNoteCollaboration (share-token auth). */
export const PublicNoteEditor = memo(PublicNoteEditorImpl);
