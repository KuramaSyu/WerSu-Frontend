import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  InputAdornment,
  Slide,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CreateIcon from "@mui/icons-material/Create";
import { note_of_date_at_hour } from "../../utils/NoteTitleTemplates";
import { getNoteApi, NoteApi } from "../../api/NoteApi";
import { UserError } from "../../api/models/UserError";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useUpdateNote } from "../../api/queries/useNoteQueries";
import { ModalShell } from "../../components/ModalShell";

export interface CreateNoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * When set, the freshly created note is moved into this directory
   * via `patchDirectory` after the create succeeds. `undefined` (and
   * `"root"`) leave the note at the root, matching the Home page
   * behaviour.
   */
  currentDirectoryId?: string;
}

export const CreateNote: React.FC<CreateNoteProps> = ({
  open,
  onOpenChange,
  currentDirectoryId,
}) => {
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState(note_of_date_at_hour());
  const [content, setContent] = useState("");
  const { mutate: updateNote } = useUpdateNote();
  const [snackbarState, setSnackbarState] = useState({ open: false });
  const [isSaving, setIsSaving] = useState(false);
  const { setMessage } = useInfoStore();

  const resetDraft = () => {
    setTitle(note_of_date_at_hour());
    setContent("");
  };

  // True when the user hasn't typed anything into the body. Routes
  // the close path into "cancel" instead of "save empty note" - the
  // fullscreen editor can't render an empty document anyway.
  const isContentEmpty = content.trim() === "";

  // Fullscreen editor needs *some* content to mount. When the user
  // clicks "open fullscreen" with an empty body, send a single
  // space so the API + editor see a non-empty document.
  const bodyForSave = isContentEmpty ? " " : content;

  const saveNote = async () => {
    if (isSaving) {
      return undefined;
    }

    setIsSaving(true);
    try {
      const note = await new NoteApi().post(title, bodyForSave);
      if (!note) {
        return undefined;
      }

      setSnackbarState({ open: true });
      updateNote({ noteId: note.id, title: note.title, content: note.content });

      if (
        currentDirectoryId &&
        currentDirectoryId !== "root" &&
        currentDirectoryId !== note.get_dir()
      ) {
        const moved = await getNoteApi().patchDirectory(
          note.id,
          currentDirectoryId,
        );
        if (!moved) {
          setMessage(
            new SnackbarUpdateImpl(
              "Note created, but failed to assign directory",
              "warning",
            ),
          );
        }
      }

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
    // Empty body = user dismissed without intending to publish.
    if (isContentEmpty) {
      onOpenChange(false);
      resetDraft();
      return;
    }

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
      <ModalShell
        open={open}
        onClose={() => void closeDialog()}
        icon={<CreateIcon fontSize="small" />}
        title="New note"
        subtitle="Save now or open fullscreen"
        minHeight="42vh"
        actions={
          <>
            <Button
              variant="outlined"
              onClick={() => void closeDialog()}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Tooltip title="Save and open fullscreen">
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<OpenInFullIcon fontSize="small" />}
                  onClick={() => void saveAndOpen()}
                  disabled={isSaving}
                >
                  Save &amp; open
                </Button>
              </span>
            </Tooltip>
          </>
        }
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
      </ModalShell>

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
