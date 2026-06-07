import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Dialog,
  Stack,
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
          Attachments
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
                  e.dataTransfer.setData("application/attachment-id", a.key);
                }}
              />
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        {selectedAttachment && (
          <AttachmentView attachment={selectedAttachment} />
        )}
      </Dialog>
    </>
  );
};
