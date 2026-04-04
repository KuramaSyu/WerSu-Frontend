import {
  Box,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { M3 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { blendWithContrast } from "../../utils/blendWithContrast";
import type { MinimalNote } from "../../api/models/search";
import { useDraggable } from "@dnd-kit/react";
import { useNavigate } from "react-router-dom";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import { useState } from "react";
import { NoteEditorModal } from "./Modals/Editor/NoteEditModal";
import { NoteApi, type INoteApi } from "../../api/NoteApi";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";

export const NoteCard: React.FC<{
  note: MinimalNote;
  sx?: object;
}> = ({ note, sx }) => {
  const { ref, isDragging } = useDraggable({
    id: note.id,
    type: "note",
    data: {
      noteId: note.id,
    },
  });
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const { setMessage } = useInfoStore();

  return (
    <Box ref={ref}>
      <Card
        ref={ref}
        sx={{
          position: "relative",
          minWidth: "4rem",
          cursor: "grab",
          opacity: isDragging ? 0.6 : 1,
          transition: "all 0.2s ease-in-out",
          "&:hover": {
            transform: "scale(1.04)",
            boxShadow: theme.shadows[4],
            borderColor: blendWithContrast(
              theme.palette.primary.main,
              theme,
              1 / 2,
            ),
          },
          ...sx,
        }}
        variant="outlined"
        onClick={() => setModalOpen(true)}
      >
        <Tooltip title="Open fullscreen">
          <IconButton
            size="small"
            aria-label="Open note fullscreen"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/n/${note.id}`);
            }}
            onMouseDown={(event) => {
              // Prevent drag start when the hover action is clicked.
              event.stopPropagation();
            }}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              opacity: 0,
              transform: "translateY(-2px)",
              transition: "opacity 0.18s ease, transform 0.18s ease",
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              zIndex: 2,
              ".MuiCard-root:hover &": {
                opacity: 1,
                transform: "translateY(0)",
              },
            }}
          >
            <OpenInFullIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <CardContent>
          <Typography
            variant="subtitle2"
            mb={M3}
            color={blendWithContrast(theme.palette.text.primary, theme, 1 / 4)}
          >
            {new Date(note.updated_at).toLocaleString()}
          </Typography>
          <Typography
            variant="h5"
            gutterBottom
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              wordBreak: "break-word",
            }}
          >
            {note.title}
          </Typography>
          <Typography
            variant="body2"
            color={theme.palette.text.secondary}
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              wordBreak: "break-word",
            }}
          >
            {note.stripped_content.substring(0, 100)}
          </Typography>
        </CardContent>
      </Card>

      <NoteEditorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={note.title}
        content={note.stripped_content}
        onSave={(title: string, content: string) => {
          const api: INoteApi = new NoteApi();
          api
            .patch(note.id, title, content)
            .then(() => {
              setMessage(new SnackbarUpdateImpl("Note saved", "success"));
            })
            .catch(() => {
              setMessage(
                new SnackbarUpdateImpl("Failed to save note", "error"),
              );
            });
        }}
      />
    </Box>
  );
};
