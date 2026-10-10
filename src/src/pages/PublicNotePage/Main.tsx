import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Box, Fade } from "@mui/material";
import { usePublicShare } from "../../api/queries/publicSharingQueries";
import { useNote, useUpdateNote } from "../../api/queries/useNoteQueries";
import { useAuthStore } from "../../zustand/useAuthStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useViewConfig } from "../../zustand/useViewConfig";
import { useThemeStore } from "../../zustand/useThemeStore";
import {
  useLeftPanel,
  useRightPanel,
  usePanelSize,
} from "../../LayoutProvider";
import { M3, M4 } from "../../statics";
import type { Note } from "../../api/models/search";
import { PublicNoteEditor } from "../NotePage/Editor";
import { NoteEditorSkeleton } from "../NotePage/NoteEditorSkeleton";
import { PublicShareUnavailable } from "./PublicShareUnavailable";
import { getPublicCollabEntry } from "../../hooks/usePublicNoteCollaboration";
import { NoteLeftPanel } from "../NotePage/Panel/MainLeft";
import { NoteRightPanel } from "../NotePage/Panel/MainRight";
import { useScrollToSectionOnLoad } from "../../hooks/useScrollToSectionOnLoad";
import { usePublicRouteReady } from "../../hooks/usePublicRouteReady";

/**
 * Route `/public/n/:share_id` - opens a note published through a
 * public share. The viewer's auth is the share JWT, written into
 * `useAuthStore.shareAccessToken` by `useShareAccessToken`. `Bootstrap`
 * installs the share-token provider on `/public/*` so any API that
 * extends `ShareTokenBearer` (e.g. `NoteApi`) attaches
 * `Authorization: Bearer <jwt>` to outgoing requests.
 *
 * The note always loads in read mode via the REST API; the Hocuspocus
 * session is only opened when the user opts into write mode.
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
  const { ready } = usePublicRouteReady();

  const noteIdFromGrant = grant?.note_id;
  const {
    data: note,
    isError: noteIsError,
    error: noteError,
  } = useNote(noteIdFromGrant, ready);

  const isWrite = grant?.permission === "SHARE_PERMISSION_WRITE";
  console.debug("PublicNotePage", {
    note,
    ready,
    share_id,
    grant,
    noteIdFromGrant,
    isWrite,
  });
  const { mutate } = useUpdateNote();
  const updateNote = (n: Note) => {
    if (!noteIdFromGrant) return;
    mutate({
      noteId: noteIdFromGrant,
      title: n.title,
      content: n.content,
    });
  };

  // Mount the same left and right rails as the private note page
  useLeftPanel(
    <NoteLeftPanel
      noteId={noteIdFromGrant}
      onNoteUpdated={updateNote}
      readOnly
    />,
    [noteIdFromGrant],
  );
  useRightPanel(<NoteRightPanel noteId={noteIdFromGrant} />, [noteIdFromGrant]);
  usePanelSize({
    left: `clamp(15rem, 25vw, 30rem)`,
    right: "21rem",
    openLeft: "lg",
    openRight: "xl",
  });

  // Honour `?section=<slug>` deep-link (same hook as the private note page).
  useScrollToSectionOnLoad();

  // Force read mode per default
  useEffect(() => {
    if (!grant) return;

    useAuthStore.getState().resetShareAttachmentTokens();
    useEditorSettings.getState().setWrite(false);
    useViewConfig.getState().setViewConfig({ readOnly: !isWrite });

    return () => {
      useEditorSettings.getState().setWrite(false);
      useViewConfig.getState().resetViewConfig();
      useAuthStore.getState().setShareAccessToken(null);
      useAuthStore.getState().resetShareAttachmentTokens();
      if (noteIdFromGrant) {
        getPublicCollabEntry(noteIdFromGrant)?.provider.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grant?.permission, grant?.note_id]);

  const shareAttachmentTokensLoaded = useAuthStore(
    (s) => s.shareAttachmentTokensLoaded,
  );

  const noteReady = note !== undefined && shareAttachmentTokensLoaded;

  // Sync the per-attachment JWTs into the auth store
  const tokens = note?.tokens;
  useEffect(() => {
    // depend on id. it could maybe not contain any tokens
    useAuthStore.getState().setShareAttachmentTokens(tokens ?? {});
  }, [note?.id]);

  // Tripwire: if the share JWT never arrives, swap the skeleton
  // for the unavailability surface instead of waiting forever.
  const { timedOut: jwtTimedOut } = usePublicRouteReady();

  if (isError) {
    return <PublicShareUnavailable error={error} />;
  }
  if (jwtTimedOut) {
    return (
      <PublicShareUnavailable
        error={
          new Error(
            "Share session expired before it could be loaded. Please reload the link.",
          )
        }
      />
    );
  }
  if (noteIsError) {
    return <PublicShareUnavailable error={noteError} />;
  }
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
      }}
    >
      <Fade
        in={!noteReady}
        timeout={{
          enter: theme.transitions.duration.enteringScreen,
          exit: theme.transitions.duration.complex,
        }}
        unmountOnExit
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
          }}
        >
          <NoteEditorSkeleton showSourceEditor={false} />
        </Box>
      </Fade>
      <Fade
        in={noteReady}
        timeout={{
          enter: theme.transitions.duration.complex,
          exit: theme.transitions.duration.complex,
        }}
        unmountOnExit
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
              noteId={grant?.note_id ?? ""}
              fetchError={null}
              onNoteUpdated={updateNote}
              key={grant?.note_id ?? ""}
            />
          </Box>
        </Box>
      </Fade>
    </Box>
  );
};
