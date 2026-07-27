import { Dialog, CircularProgress, Box } from "@mui/material";
import { useAttachmentPreviewStore } from "../../../zustand/useAttachmentPreviewStore";
import { useActiveNoteStore } from "../../../zustand/editorStore";
import { useAttachmentMetadata } from "../../../api/queries/useAttachmentQueries";
import { AttachmentView } from "../../../pages/NotePage/AttachmentView";

/**
 * Single editor-wide modal that previews an attachment when a node
 * view calls `useAttachmentPreviewStore.open(key)`. Lives at the
 * editor root so node views only emit triggers.
 *
 * Lookup: `useAttachmentMetadata(noteId, key)` reads the per-note
 * attachment cache first, then falls back to a one-shot fetch.
 * `AttachmentView`'s `bigView` flag widens to ~95vw.
 */
export function AttachmentPreviewModal() {
  const key = useAttachmentPreviewStore((s) => s.key);
  const close = useAttachmentPreviewStore((s) => s.close);
  const noteId = useActiveNoteStore((s) => s.noteId);

  const {
    data: attachment,
    isLoading,
    error,
  } = useAttachmentMetadata(noteId, key ?? "");

  return (
    <Dialog
      open={key !== null}
      onClose={close}
      maxWidth={false}
      fullWidth={false}
      slotProps={{
        paper: {
          sx: {
            maxHeight: "none",
            overflow: "visible",
            backgroundColor: "transparent",
            boxShadow: "none",
          },
        },
      }}
    >
      {key === null ? null : isLoading || !attachment ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 320,
            minHeight: 240,
            backgroundColor: "background.paper",
            borderRadius: 1,
          }}
        >
          {error ? (
            <Box sx={{ p: 3, color: "error.main" }}>
              Failed to load attachment.
            </Box>
          ) : (
            <CircularProgress />
          )}
        </Box>
      ) : (
        <AttachmentView
          attachment={attachment}
          onClose={close}
          noteId={noteId}
        />
      )}
    </Dialog>
  );
}
