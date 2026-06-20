import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  LinearProgress,
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
import { useAttachments } from "../../api/queries/useAttachmentQueries";
import { set } from "zod";

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

  const [requestOpen, setRequestOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: attachments } = useAttachments(
    note.id,
    note.get_attachment_ids(),
    requestOpen,
  );

  // expand the accordion, as soon as data is loaded after user requested it by clicking
  useEffect(() => {
    console.log("attachments", attachments);
    if (requestOpen && attachments !== undefined) {
      setExpanded(true);
    }
  }, [attachments, requestOpen]);

  const loading = requestOpen && attachments === undefined;

  return (
    <>
      {/* with wrap we get as much chips in a row as possible, and then wrap to
      the next line */}
      <Accordion
        elevation={2}
        expanded={expanded}
        onChange={(_, isExpanded) => {
          if (isExpanded) {
            setRequestOpen(true);
          } else {
            setExpanded(false);
            setRequestOpen(false);
          }
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} color="primary">
          <Stack direction={"column"}>
            <Typography component="span" sx={{ width: "33%", flexShrink: 0 }}>
              Attachments
            </Typography>
            <Typography
              component="span"
              sx={{ color: "textSecondary" }}
              variant="caption"
            >
              Click to view or drag into the editor
            </Typography>
            {loading && <LinearProgress sx={{ mt: 1 }} />}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
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
