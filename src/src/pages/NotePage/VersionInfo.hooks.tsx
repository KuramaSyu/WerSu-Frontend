import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { getNoteApi } from "../../api/NoteApi";

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

// Loads a historical version into the editor. In view mode this only
// mirrors the version into the editor store so the user can preview it.
//
// In edit mode for a logged-in note we ask the backend to restore the
// version (`POST /notes/:id/versions/:index/restore`). That makes the
// restore durable and records it in the version history, which is the
// part the old local-only flow got wrong: writing the historical
// content into the live Y.Doc updated the current tab but never reached
// the note's persisted state. The server replies with the restored
// note, and we then push that content into the live Y.Doc so every
// collaborator sees it immediately.
//
// Public/share sessions have no user session for the restore endpoint,
// so they keep applying the already-fetched version locally.
//
// We deliberately do NOT rebuild the collab session: a fresh Y.Doc
// seeded before the provider's first sync merges with the server's
// live document as concurrent CRDT inserts, duplicating the whole doc.
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
  const queryClient = useQueryClient();

  const restoreVersion = useCallback(
    async (
      version: NoteVersionSummaryReply,
      note: Note | undefined,
    ): Promise<void> => {
      if (!noteId) {
        console.error("Note ID is required to restore version");
        return;
      }
      setIsRestoringVersion(true);
      try {
        // Durably restore server-side when we have a logged-in session.
        // Public/share viewers fall back to the fetched version content.
        const restored =
          editMode && !isPublic
            ? await getNoteApi().restoreVersion(
                noteId,
                version.version_index,
              )
            : note;

        if (!restored?.title || !restored.content) {
          console.error("Versioned note data is incomplete");
          setMessage(
            new SnackbarUpdateImpl(
              "Versioned note data is incomplete",
              "error",
            ),
          );
          return;
        }

        // Keep the REST detail/list caches in step with the restore so
        // the editor seeds from the restored note on the next mount.
        queryClient.setQueryData(["notes", noteId], restored);
        queryClient.invalidateQueries({ queryKey: ["notes"] });
        queryClient.invalidateQueries({
          queryKey: ["activity", "note", noteId],
        });

        // Mirror the restored title/content into the live editor. In
        // edit mode this reconciles the shared Y.Doc in place; in view
        // mode it previews via the editor command path.
        setTitle(restored.title);
        setContent(restored.content);
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
    [
      noteId,
      editMode,
      isPublic,
      queryClient,
      setMessage,
      setTitle,
      setContent,
    ],
  );

  return { isRestoringVersion, restoreVersion };
}
