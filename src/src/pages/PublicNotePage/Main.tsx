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

  const isWrite = grant?.permission === "SHARE_PERMISSION_WRITE";
  const noteIdFromGrant = grant?.note_id;

  const {
    data: note,
    isError: noteIsError,
    error: noteError,
  } = useNote(noteIdFromGrant);

  const { mutate } = useUpdateNote();
  const updateNote = (n: Note) => {
    if (!noteIdFromGrant) return;
    mutate({
      noteId: noteIdFromGrant,
      title: n.title,
      content: n.content,
    });
  };

  // Mount the same left and right rails as the private note page so the
  // share view shows the metadata block + outline on the left and
  // version history + attachments on the right. The left panel is
  // pinned to read-only: a share viewer can't move the note between
  // directories. Same panel sizes and breakpoints as `NotePage`.
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

  // Force read mode per default; the user can flip to write if the
  // share grants it. On mount: reset the per-attachment JWT map so a
  // prior share's tokens don't satisfy the new note's requests. On
  // unmount: clear share token + collab provider + JWT map.
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

  useEffect(() => {
    console.log("PublicNotePage - note", note);
    useAuthStore.getState().setShareAttachmentTokens(note?.tokens ?? {});
  }, [note]);

  if (isError) {
    return <PublicShareUnavailable error={error} />;
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
