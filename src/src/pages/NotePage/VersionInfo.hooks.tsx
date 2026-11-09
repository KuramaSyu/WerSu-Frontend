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

// Loads a historical version into the editor for display only.
//
// This never saves and never creates a version: the version content is
// fetched with `GET /notes/:id/versions/:index`, mirrored into the
// editor/title store, and that is it. No `PATCH`, no restore endpoint,
// no query invalidation that could pull the live note back in.
//
// Both read and edit mode use the same path. Read mode has no bound
// Y.Doc, so `replaceContent` replaces the ProseMirror document. Edit
// mode (live or offline) has the shared Y.Doc bound, so the whole
// fragment is cleared and rewritten in one transaction. The provider
// syncs that like any other collaborative edit, but the button itself
// never persists anything on its own.
//
// The previous flow diffed the historical content into the live
// fragment through `setContent`, whose fresh mapping often matched by
// node type and left parts of the old document in place. It also
// called the server-side restore endpoint, which recorded a new
// version. Both are gone.
export function useVersionRestore(noteId: string | undefined): {
  isRestoringVersion: boolean;
  restoreVersion: (version: NoteVersionSummaryReply) => Promise<void>;
} {
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);
  const { setMessage } = useInfoStore();
  const { setTitle, replaceContent } = useActiveNoteStore();
  const queryClient = useQueryClient();

  const restoreVersion = useCallback(
    async (version: NoteVersionSummaryReply): Promise<void> => {
      if (!noteId) {
        console.error("Note ID is required to load version");
        return;
      }
      setIsRestoringVersion(true);
      try {
        // Fetch the version itself. The caller only has the summary,
        // and the drawer used to pass its currently previewed note,
        // which could be a different version than the row clicked.
        // The shared query key matches `useNoteVersion` so prefetched
        // previews are reused.
        const note = await queryClient.fetchQuery({
          queryKey: ["notes", noteId, "version", version.version_index],
          queryFn: () =>
            getNoteApi().getVersion(noteId, version.version_index),
        });

        const content = note?.content || note?.stripped_content || "";
        if (!note || !content) {
          console.error("Versioned note data is incomplete");
          setMessage(
            new SnackbarUpdateImpl(
              "Versioned note data is incomplete",
              "error",
            ),
          );
          return;
        }

        setTitle(note.title);
        replaceContent(content);
        setMessage(
          new SnackbarUpdateImpl(
            `Showing v${version.version_index}`,
            "success",
          ),
        );
      } catch (error) {
        console.error("Loading version failed", error);
        setMessage(
          new SnackbarUpdateImpl("Failed to load version", "error"),
        );
      } finally {
        setIsRestoringVersion(false);
      }
    },
    [noteId, queryClient, setMessage, setTitle, replaceContent],
  );

  return { isRestoringVersion, restoreVersion };
}
