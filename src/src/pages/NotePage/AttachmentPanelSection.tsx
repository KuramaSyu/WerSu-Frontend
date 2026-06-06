import { Box, Chip, Stack, Typography, useTheme } from "@mui/material";
import type { AttachmentMetadata } from "../../api/models/attachment";
import { useThemeStore } from "../../zustand/useThemeStore";

export interface AttachmentPanelSectionProps {
  noteAttachments: AttachmentMetadata[];
}

export const AttachmentPanelSection: React.FC<AttachmentPanelSectionProps> = ({
  noteAttachments,
}) => {
  const { theme } = useThemeStore();
  return (
    // with wrap we get as much chips in a row as possible, and then wrap to the next line
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: theme.spacing(1) }}>
      {noteAttachments.map((a) => (
        <Chip
          key={a.key}
          label={a.filename}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/attachment-id", a.key);
          }}
        />
      ))}
    </Box>
  );
};
