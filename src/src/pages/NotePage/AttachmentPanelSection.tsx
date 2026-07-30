import {
  Box,
  Chip,
  Dialog,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import type { AttachmentMetadata } from "../../api/models/attachment";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useState } from "react";
import { AttachmentView } from "./AttachmentView";
import type { Note } from "../../api/models/search";
import { useAttachments } from "../../api/queries/useAttachmentQueries";
import { PanelSection } from "../../components/Panels/PanelSection";

export interface AttachmentPanelSectionProps {
  note: Note;
  // maybe for later to overwrite own logic
  noteAttachments?: AttachmentMetadata[];
}

export interface ApplicationAttachmentBody {
  key: string;
  filename: string;
  contentType: string;
}

export const AttachmentPanelSection: React.FC<AttachmentPanelSectionProps> = ({
  note,
}) => {
  const { theme } = useThemeStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] =
    useState<AttachmentMetadata | null>(null);

  const attachmentIds = note.attachment_ids ?? [];
  const hasAttachments = attachmentIds.length > 0;

  const { data: attachments } = useAttachments(
    note.id,
    attachmentIds,
    hasAttachments,
  );

  const loading = hasAttachments && attachments === undefined;

  return (
    <>
      <PanelSection title="Attachments" collapsible defaultExpanded={false}>
        <Stack spacing={1}>
          <Typography
            component="span"
            sx={{ color: "textSecondary" }}
            variant="caption"
          >
            Click to view or drag into the editor
          </Typography>
          {loading && <LinearProgress />}
          {hasAttachments && (
            <Box
              sx={{ display: "flex", flexWrap: "wrap", gap: theme.spacing(1) }}
            >
              {attachments
                ?.filter((a) => !!a)
                .map((a) => (
                  <Chip
                    key={a.key}
                    label={a.filename}
                    draggable
                    onClick={() => {
                      setSelectedAttachment(a);
                      setDialogOpen(true);
                    }}
                    onDragStart={(e) => {
                      console.log(
                        `start dragging attachment ${a.filename} with key ${a.key} and content type ${a.content_type}`,
                      );
                      e.dataTransfer.setData(
                        "application/x-application-attachment",

                        JSON.stringify({
                          key: a.key,
                          filename: a.filename,
                          contentType: a.content_type,
                        } as ApplicationAttachmentBody),
                      );
                    }}
                    sx={{
                      "&:hover": {
                        cursor: "pointer",
                        backgroundColor: theme.palette.primary.main,
                        color: theme.blendWithContrast(
                          theme.palette.primary.main,
                          0.7,
                          undefined,
                        ),
                      },
                    }}
                  />
                ))}
            </Box>
          )}
        </Stack>
      </PanelSection>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth={false}
        fullWidth={false}
        slotProps={{
          paper: {
            sx: {
              maxHeight: "none",
              overflow: "visible",
            },
          },
        }}
      >
        {selectedAttachment && (
          <AttachmentView
            attachment={selectedAttachment}
            onClose={() => setDialogOpen(false)}
            noteId={note.id}
          />
        )}
      </Dialog>
    </>
  );
};
