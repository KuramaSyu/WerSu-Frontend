// ---------------------------------------------------------------------------
// CollabConflictController
// Subscribes to the collab status store and renders the
// `CollabConflictModal` when the status is `conflict`. Owns the
// resolution flow:
//
//   - "Use cloud" -> write the server's markdown to the local ydoc
//     (via the active-note store's setContent, which takes the
//     ydoc-direct fast path). Clears the local-edit flag.
//   - "Use local" -> PATCH the local markdown to the server. Once
//     the patch lands, the ydoc-direct write replaces any server
//     state with our local content. Clears the local-edit flag.
//   - "Stay offline" -> re-attach IndexedDB (it was kept warm) and
//     flip the status back to editingOffline so the user can keep
//     editing locally.
//
// The controller lives in the NoteEditorCore tree so it has access
// to `useNote` / `useUpdateNote` via the active-note store. It is
// memoized so per-keystroke re-renders don't re-mount the modal.
// ---------------------------------------------------------------------------

import { memo, useEffect, useState } from "react";
import { CollabConflictModal } from "../../components/CollabConflictModal";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useUpdateNote, useNote } from "../../api/queries/useNoteQueries";
import {
  collabStatusStore,
  useCollabStatus,
} from "../../zustand/useCollabStatusStore";
import {
  clearLocalEditsFor,
  getCollabEntry,
  goOffline,
} from "../../hooks/useNoteCollaboration";
import type { Note } from "../../api/models/search";

const CollabConflictControllerImpl: React.FC<{
  noteId: string | undefined;
}> = ({ noteId }) => {
  const status = useCollabStatus(noteId);
  const { mutateAsync: updateNote } = useUpdateNote();
  // Pull the latest server content from the React Query cache so the
  // modal has the most up-to-date cloud markdown. We also re-fetch
  // on status -> "conflict" so the cloud-side is fresh even if the
  // user has been on the conflict screen for a while.
  const { data: serverNote, refetch: refetchServer } = useNote(noteId);
  const [resolving, setResolving] = useState(false);

  // Re-fetch the server's view when the modal opens. The Hocuspocus
  // sync may have just landed and `useNote` is stale.
  useEffect(() => {
    if (status === "conflict" && noteId) {
      void refetchServer();
    }
  }, [status, noteId, refetchServer]);

  if (status !== "conflict" || !noteId) return null;

  const localMarkdown = useActiveNoteStore.getState().getContent();
  // The pre-offline snapshot is the markdown captured when we went
  // offline. Fall back to the current server content if we don't
  // have one (e.g. the auto-fallback path right after WS gave up).
  const entry = getCollabEntry(noteId);
  const preOfflineCloud =
    entry?.preOfflineCloudMarkdown ??
    serverNote?.content ??
    serverNote?.stripped_content ??
    "";
  const currentCloud =
    serverNote?.content || serverNote?.stripped_content || "";

  const handleUseCloud = async () => {
    setResolving(true);
    try {
      // Replace local ydoc with the server's current markdown. The
      // ydoc-direct path in setContent handles the conversion.
      useActiveNoteStore.getState().setContent(currentCloud);
      // Clear local-edit tracking so a future conflict check is honest.
      clearLocalEditsFor(noteId);
      collabStatusStore.getState().setStatus(noteId, "connected");
    } finally {
      setResolving(false);
    }
  };

  const handleUseLocal = async () => {
    setResolving(true);
    try {
      // Push local content to the server. The PATCH goes through
      // the regular REST path so the ydoc-direct write is not
      // needed; Hocuspocus will pick up the server's new state on
      // the next sync.
      const { sourceMarkdown, title } = useActiveNoteStore.getState();
      await updateNote({ noteId, title, content: sourceMarkdown });
      clearLocalEditsFor(noteId);
      collabStatusStore.getState().setStatus(noteId, "connected");
    } catch (err) {
      // Leave the conflict state up; the user can retry. (A
      // follow-up could open a snackbar with the error.)
      console.error("use-local PATCH failed", err);
    } finally {
      setResolving(false);
    }
  };

  const handleCancel = () => {
    // Stay offline. We re-attach (no-op if still attached) and flip
    // back to editingOffline so the user can keep working locally
    // while they think.
    void goOffline(noteId, "manual", preOfflineCloud);
  };

  return (
    <CollabConflictModal
      open
      localMarkdown={localMarkdown}
      preOfflineCloud={preOfflineCloud}
      currentCloud={currentCloud}
      lastLocalEditAt={entry?.lastLocalEditAt ?? null}
      currentCloudUpdatedAt={
        (serverNote as Note | undefined)?.updated_at ?? null
      }
      resolving={resolving}
      onUseCloud={handleUseCloud}
      onUseLocal={handleUseLocal}
      onCancel={handleCancel}
    />
  );
};

export const CollabConflictController = memo(CollabConflictControllerImpl);
