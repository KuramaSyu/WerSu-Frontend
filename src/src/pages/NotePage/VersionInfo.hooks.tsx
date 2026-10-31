import { useCallback, useEffect, useMemo, useState } from "react";
import { useNote, useNoteVersion } from "../../api/queries/useNoteQueries";
import { useNoteActivity } from "../../api/queries/recentActivity";
import { useUser, useUsers } from "../../api/queries/useUser";
import { useLiveUsers } from "../../zustand/useLiveUsersStore";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import type { Note } from "../../api/models/search";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useActiveNoteStore } from "../../zustand/editorStore";

// Hook: selection + content for a historical note version.
// Latest uses the live cache; others fetch via useNoteVersion.
export function useVersionSelection(noteId: string | undefined): {
  versions: NoteVersionSummaryReply[] | undefined;
  selectedVersion: NoteVersionSummaryReply | null;
  selectedVersionContent: Note | undefined;
  selectVersion: (v: NoteVersionSummaryReply) => void;
  clearSelection: () => void;
} {
  const [selectedVersion, setSelectedVersion] =
    useState<NoteVersionSummaryReply | null>(null);

  const { data: versions } = useNoteActivity(noteId ?? "");
  const { data: user } = useUser();
  const liveUsers = useLiveUsers(noteId);
  const userIds = useMemo(
    () => [...new Set(liveUsers.map((u) => u.userId))],
    [liveUsers],
  );
  const { data: usersById } = useUsers(userIds);

  // For the latest version the live note cache already has the content.
  const latestVersionIndex = versions?.[0]?.version_index;
  const isLatestSelected =
    selectedVersion?.version_index !== undefined &&
    selectedVersion.version_index === latestVersionIndex;
  const { data: fetchedSelectedVersionContent } = useNoteVersion(
    noteId,
    isLatestSelected ? undefined : selectedVersion?.version_index,
  );
  const { data: cachedNote } = useNote(noteId);
  const selectedVersionContent: Note | undefined = isLatestSelected
    ? (cachedNote ?? undefined)
    : fetchedSelectedVersionContent;

  // Auto-select latest in read mode; drop selection once the user edits.
  useEffect(() => {
    if (!usersById || !user) {
      return;
    }
    const isEditing = usersById[user.id] !== undefined;
    if (isEditing && selectedVersion !== null) {
      setSelectedVersion(null);
      return;
    }
    if (!isEditing && !selectedVersion && versions && versions.length > 0) {
      setSelectedVersion(versions[0]);
    }
  }, [usersById, selectedVersion, user, versions]);

  const selectVersion = useCallback(
    (v: NoteVersionSummaryReply) => {
      if (!noteId) {
        return;
      }
      setSelectedVersion(v);
    },
    [noteId],
  );
  const clearSelection = useCallback(() => setSelectedVersion(null), []);

  return {
    versions,
    selectedVersion,
    selectedVersionContent,
    selectVersion,
    clearSelection,
  };
}

// Loads a historical version into the editor for review. No explicit
// server write happens here -- the version is mirrored into the
// active-note store and `setContent` applies it to the editor.
//
// In edit mode the editor is already bound to the live, synced Y.Doc,
// so `setContent`'s fast path diffs the shared XmlFragment down to the
// historical content. That keeps the restore a normal collaborative
// edit and the provider pushes it to the server like any other change.
//
// We deliberately do NOT rebuild the collab session here. Rebuilding
// swapped in a fresh, empty Y.Doc and wrote the restore into it before
// the provider's first sync landed. The local restore and the server's
// live document then merged as concurrent CRDT inserts, duplicating
// the whole doc. The live doc is the source of truth and already holds
// the content to diff against, so there is nothing to rebuild.
//
// View mode has no live session (`ydoc` is null), so `setContent`
// falls back to `editor.commands.setContent`, previewing the
// historical content without touching any shared state.

// Hook: restore a historical version into the editor. Applies the
// version on top of the existing (already synced) session in both
// modes.
export function useVersionRestore(noteId: string | undefined): {
  isRestoringVersion: boolean;
  restoreVersion: (
    version: NoteVersionSummaryReply,
    note: Note | undefined,
  ) => Promise<void>;
} {
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);
  const { setMessage } = useInfoStore();
  const { setTitle, setContent } = useActiveNoteStore();

  const restoreVersion = useCallback(
    async (
      version: NoteVersionSummaryReply,
      note: Note | undefined,
    ): Promise<void> => {
      if (!noteId) {
        console.error("Note ID is required to restore version");
        return;
      }
      if (!note?.title || !note.content) {
        console.error("Versioned note data is incomplete");
        setMessage(
          new SnackbarUpdateImpl("Versioned note data is incomplete", "error"),
        );
        return;
      }
      setIsRestoringVersion(true);
      try {
        // Mirror the historical title/content into the local store.
        // In edit mode this reconciles the live shared Y.Doc in place;
        // in view mode it previews via the editor command path.
        setTitle(note.title);
        setContent(note.content);
        setMessage(
          new SnackbarUpdateImpl(
            `Restored v${version.version_index}`,
            "success",
          ),
        );
      } catch (error) {
        console.error("Restore failed", error);
        setMessage(
          new SnackbarUpdateImpl("Failed to restore version", "error"),
        );
      } finally {
        setIsRestoringVersion(false);
      }
    },
    [noteId, setMessage, setTitle, setContent],
  );

  return { isRestoringVersion, restoreVersion };
}
