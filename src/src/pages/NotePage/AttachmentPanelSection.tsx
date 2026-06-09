import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Dialog,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import type { AttachmentMetadata } from "../../api/models/attachment";
import { useThemeStore } from "../../zustand/useThemeStore";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useEffect, useState } from "react";
import { AttachmentView } from "./AttachmentView";
import type { Note } from "../../api/models/search";
import { AttachmentApi } from "../../api/AttachmentApi";
import { useQuery } from "@tanstack/react-query";
import { useAttachmentStore } from "../../zustand/useAttachmentStore";

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
  noteAttachments,
}) => {
  const { theme } = useThemeStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] =
    useState<AttachmentMetadata | null>(null);

  const { setAttachments, attachmentsById } = useAttachmentStore();
  const [expanded, setExpanded] = useState(false);

  const attachmentsQuery = useQuery({
    queryKey: ["attachments", note.id],
    enabled: expanded,
    staleTime: Infinity,
    queryFn: async () => {
      const ids = note.get_attachment_ids();
      // request metadata for each attachment id and save as promise array
      const api = new AttachmentApi();
      const promises = [];

      for (const id of ids) {
        promises.push(api.getAttachmentMetadata(id));
      }
      const results = await Promise.all(promises);
      const metadatas = results.filter((m) => m !== null);

      setAttachments(note.id, metadatas);
    },
  });

  return (
    <>
      {/* with wrap we get as much chips in a row as possible, and then wrap to
      the next line */}
      <Accordion
        elevation={2}
        onChange={(_, isExpanded) => setExpanded(isExpanded)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} color="primary">
          <Stack direction={"column"}>
            <Typography component="span" sx={{ width: "33%", flexShrink: 0 }}>
              Attachments
            </Typography>
            <Typography
              component="span"
              sx={{ color: "text.secondary" }}
              variant="caption"
            >
              Click to view or drag into the editor
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            sx={{ display: "flex", flexWrap: "wrap", gap: theme.spacing(1) }}
          >
            {attachmentsById[note.id]?.map((a) => (
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
                    ),
                  },
                }}
              />
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>
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
          />
        )}
      </Dialog>
    </>
  );
};
