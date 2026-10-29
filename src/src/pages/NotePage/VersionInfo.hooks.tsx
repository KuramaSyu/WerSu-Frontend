import { useCallback, useEffect, useMemo, useState } from "react";
import { useNote, useNoteVersion } from "../../api/queries/useNoteQueries";
import { useNoteActivity } from "../../api/queries/recentActivity";
import { useUser, useUsers } from "../../api/queries/useUser";
import { useLiveUsers } from "../../zustand/useLiveUsersStore";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import type { Note } from "../../api/models/search";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { usePublicRouteReady } from "../../hooks/usePublicRouteReady";
import { rehydrateCollabSession } from "../../hooks/useNoteCollaboration";

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

// Loads a historical version into the editor for review. No server
// write happens here -- the user reviews the restored content in
// the editor and triggers an explicit save.
//
// Edit mode rebuilds the collab session (ydoc + provider) so the
// editor binds to a fresh doc and Hocuspocus pushes the user's
// future edits back to the server. View mode skips the rebuild:
// no collab session is open in read mode (Editor.tsx gates
// useNoteCollaboration on editMode), so writing a fresh entry to
// the cache would only leave it dangling until the user toggles
// to edit mode -- and at that point they want to see Live again,
// not the version preview. Instead, view mode just mirrors the
// historical title/content into the editor store so the user can
// preview the historical version without any side effects.

// Hook: restore a historical version into the editor.
// Edit mode rebuilds collab; view mode only mirrors content.
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
  const { editMode } = useEditorSettings();
  const { isPublic } = usePublicRouteReady({ timeoutMs: 0 });

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
        if (editMode) {
          // Rebuild ydoc + provider so the editor binds to a fresh doc.
          if (isPublic) {
            const { rehydratePublicCollabSession } =
              await import("../../hooks/usePublicNoteCollaboration");
            await rehydratePublicCollabSession(noteId);
          } else {
            await rehydrateCollabSession(noteId);
          }
        }
        // Mirror the historical title/content into the local store.
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
    [noteId, editMode, isPublic, setMessage, setTitle, setContent],
  );

  return { isRestoringVersion, restoreVersion };
}
