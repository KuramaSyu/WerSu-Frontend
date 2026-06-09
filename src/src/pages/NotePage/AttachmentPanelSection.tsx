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
import { useState } from "react";
import { AttachmentView } from "./AttachmentView";

export interface AttachmentPanelSectionProps {
  noteAttachments: AttachmentMetadata[];
}

export interface ApplicationAttachmentBody {
  key: string;
  filename: string;
  contentType: string;
}

export const AttachmentPanelSection: React.FC<AttachmentPanelSectionProps> = ({
  noteAttachments,
}) => {
  const { theme } = useThemeStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] =
    useState<AttachmentMetadata | null>(null);

  return (
    <>
      {/* with wrap we get as much chips in a row as possible, and then wrap to
      the next line */}
      <Accordion elevation={2}>
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
            {noteAttachments.map((a) => (
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
