import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Slide,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CreateIcon from "@mui/icons-material/Create";
import { note_of_date_at_hour } from "../../utils/NoteTitleTemplates";
import { NoteApi } from "../../api/NoteApi";
import { UserError } from "../../api/models/UserError";
import { useNotesStore } from "../../zustand/useNotesStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { M3 } from "../../statics";

export interface CreateNoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateNote: React.FC<CreateNoteProps> = ({
  open,
  onOpenChange,
}) => {
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState(note_of_date_at_hour());
  const [content, setContent] = useState("");
  const { updateNote } = useNotesStore();
  const [snackbarState, setSnackbarState] = useState({ open: false });
  const [isSaving, setIsSaving] = useState(false);
  const { setMessage } = useInfoStore();

  const resetDraft = () => {
    setTitle(note_of_date_at_hour());
    setContent("");
  };

  const saveNote = async () => {
    if (isSaving) {
      return undefined;
    }

    setIsSaving(true);
    try {
      const note = await new NoteApi().post(title, content);
      if (!note) {
        return undefined;
      }

      setSnackbarState({ open: true });
      updateNote(note);
      return note;
    } catch (error) {
      if (error instanceof UserError) {
        setMessage(
          new SnackbarUpdateImpl(
            error.title,
            "error",
            undefined,
            error.description,
          ),
        );
        return undefined;
      }

      setMessage(new SnackbarUpdateImpl("Unexpected error"));
      return undefined;
    } finally {
      setIsSaving(false);
    }
  };

  const closeDialog = async () => {
    const note = await saveNote();
    onOpenChange(false);
    resetDraft();

    if (note) {
      navigate(`/n/${note.id}`);
    }
  };

  const saveAndOpen = async () => {
    const note = await saveNote();
    if (!note) {
      return;
    }

    onOpenChange(false);
    resetDraft();
    navigate(`/n/${note.id}`);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={() => void closeDialog()}
        fullWidth
        maxWidth="md"
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: "blur(10px)",
              backgroundColor: "rgba(0, 0, 0, 0.35)",
            },
          },
          paper: {
            sx: {
              borderRadius: 4,
              border: `1px solid ${theme.palette.divider}`,
              backgroundImage: "none",
              overflow: "hidden",
              boxShadow: theme.shadows[10],
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: 2.5,
            py: 2,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 32,
                height: 32,
                borderRadius: "999px",
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.primary.main,
              }}
            >
              <CreateIcon fontSize="small" />
            </Box>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
              }}
            >
              <Box
                component="span"
                sx={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                New note
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: "0.78rem",
                  color: theme.palette.text.secondary,
                }}
              >
                Save now or open fullscreen
              </Box>
            </Box>
          </Box>

          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Save and open fullscreen">
              <span>
                <IconButton
                  onClick={() => void saveAndOpen()}
                  size="small"
                  aria-label="Save and open note fullscreen"
                  disabled={isSaving}
                >
                  <OpenInFullIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton
                onClick={() => void closeDialog()}
                size="small"
                aria-label="Close create note dialog"
                disabled={isSaving}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </DialogTitle>

        <Divider />

        <DialogContent
          sx={{
            backgroundColor: theme.palette.background.default,
            minHeight: "42vh",
            px: 2.5,
            py: 2.5,
          }}
        >
          <Stack spacing={2.25} sx={{ py: 0.5 }}>
            <TextField
              placeholder="Title"
              variant="standard"
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CreateIcon
                        sx={{
                          fontSize: "1rem",
                          color: theme.palette.text.secondary,
                        }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.15rem",
                  fontWeight: 600,
                  py: 0.5,
                },
                "& .MuiInput-root:before, & .MuiInput-root:after": {
                  borderBottomColor: theme.palette.divider,
                },
              }}
            />

            <TextField
              placeholder="Take a note..."
              variant="outlined"
              minRows={14}
              multiline
              fullWidth
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSaving}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 3,
                  backgroundColor: theme.palette.background.paper,
                  transition: "border-color 120ms ease, box-shadow 120ms ease",
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: theme.palette.divider,
                },
                "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline":
                  {
                    borderColor: theme.palette.action.active,
                  },
                "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
                  {
                    borderColor: theme.palette.primary.main,
                    borderWidth: 1,
                  },
                "& .MuiInputBase-inputMultiline": {
                  lineHeight: 1.6,
                },
              }}
            />
          </Stack>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbarState.open}
        onClose={() => setSnackbarState({ open: false })}
        slots={{ transition: Slide }}
        message="Uploaded Note"
        autoHideDuration={1200}
      />
    </>
  );
};
