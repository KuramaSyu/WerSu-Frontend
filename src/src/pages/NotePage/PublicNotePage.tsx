import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Box, Fade } from "@mui/material";
import { usePublicShare } from "../../api/queries/sharingQueries";
import { useShareAccessToken } from "../../api/queries/useShareAccessToken";
import { useNote, useUpdateNote } from "../../api/queries/useNoteQueries";
import { useAuthStore } from "../../zustand/useAuthStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useViewConfig } from "../../zustand/useViewConfig";
import { useThemeStore } from "../../zustand/useThemeStore";
import { M3, M4 } from "../../statics";
import type { Note } from "../../api/models/search";
import { PublicNoteEditor } from "./Editor";
import { NoteEditorSkeleton } from "./NoteEditorSkeleton";
import { PublicShareUnavailable } from "./PublicShareUnavailable";
import { getPublicCollabEntry } from "../../hooks/usePublicNoteCollaboration";

/**
 * Route `/public/n/:share_id` — open a note published through a public
 * share. The viewer's auth is the share JWT, written into
 * `useAuthStore.shareAccessToken` by `useShareAccessToken`. `Bootstrap`
 * installs the share-token provider on `/public/*` so any API that
 * extends `ShareTokenBearer` (e.g. `NoteApi`) attaches
 * `Authorization: Bearer <jwt>` to outgoing requests.
 *
 * Permission handling
 * -------------------
 * `grant.permission` is the canonical proto enum string:
 *   - `SHARE_PERMISSION_WRITE` → `editMode = true`, `readOnly = false`,
 *     `usePublicNoteCollaboration` opens a Hocuspocus WebSocket so
 *     edits sync through the collaboration server.
 *   - `SHARE_PERMISSION_READ` (or anything else) → `editMode = false`,
 *     `readOnly = true`. The editor mounts with an empty `Y.Doc` and
 *     a dummy provider; `NoteEditorCore` loads the note's markdown into
 *     the empty doc for rendering.
 *
 * Cleanup
 * -------
 * On unmount we clear `shareAccessToken`, reset `viewConfig` + the editor
 * write flag, and disconnect the cached Hocuspocus provider so the next
 * private-note session doesn't inherit the share grant.
 */
export const PublicNotePage: React.FC = () => {
  const { share_id } = useParams<{ share_id: string }>();
  const {
    data: grant,
    isError,
    error,
  } = usePublicShare({
    share_id: share_id ?? "",
  });
  const { theme } = useThemeStore();

  const isWrite = grant?.permission === "SHARE_PERMISSION_WRITE";
  const noteIdFromGrant = grant?.note_id;

  // Mount/unmount: flip view flags + editor write-mode + cleanup.
  useEffect(() => {
    if (!grant) return;

    useEditorSettings.getState().setWrite(isWrite);
    useViewConfig.getState().setViewConfig({ readOnly: !isWrite });

    return () => {
      useEditorSettings.getState().setWrite(false);
      useViewConfig.getState().resetViewConfig();
      useAuthStore.getState().setShareAccessToken(null);
      if (noteIdFromGrant) {
        getPublicCollabEntry(noteIdFromGrant)?.provider.disconnect();
      }
    };
    // Re-bind when the resolved permission flips, but unmount-cleanup
    // runs only on component unmount via the cleanup of *this* effect.
    // `noteIdFromGrant` is captured by reference for cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grant?.permission, grant?.note_id]);

  // Kick off the share JWT fetch/refresh loop. The hook mounts with the
  // `shareId` from the URL parameter (we pass it directly so a missing
  // grant doesn't disable the loop — the JWT is needed to fetch the
  // grant itself on a cold start, and a previous mount may have set
  // a token we want to clear on unmount).
  useShareAccessToken({ shareId: share_id ?? "" });

  const { data: note } = useNote(noteIdFromGrant);
  const { mutate } = useUpdateNote();
  const updateNote = (n: Note) => {
    if (!noteIdFromGrant) return;
    mutate({
      noteId: noteIdFromGrant,
      title: n.title,
      content: n.content,
    });
  };

  if (isError) {
    const reason = error instanceof Error ? error.message : undefined;
    return <PublicShareUnavailable reason={reason} />;
  }
  if (!grant || !noteIdFromGrant) {
    return (
      <Box sx={{ p: M4 }}>
        <NoteEditorSkeleton showSourceEditor={false} />
      </Box>
    );
  }
  if (!note) {
    return (
      <Box sx={{ p: M4 }}>
        <NoteEditorSkeleton showSourceEditor={false} />
      </Box>
    );
  }

  return (
    <Fade
      in
      timeout={{
        enter: theme.transitions.duration.complex,
        exit: theme.transitions.duration.complex,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "row",
          height: "100%",
        }}
      >
        <Box
          sx={{
            pb: M4,
            height: "calc(100% - 8rem)",
            width: "100%",
            display: "flex",
            gap: M3,
            alignItems: "flex-start",
          }}
        >
          <PublicNoteEditor
            note={note}
            noteId={noteIdFromGrant}
            fetchError={null}
            onNoteUpdated={updateNote}
            key={noteIdFromGrant}
          />
        </Box>
      </Box>
    </Fade>
  );
};
