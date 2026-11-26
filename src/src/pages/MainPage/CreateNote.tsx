import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  Box,
  Button,
  FormHelperText,
  InputAdornment,
  Slide,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CreateIcon from "@mui/icons-material/Create";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { note_of_date_at_hour } from "../../utils/NoteTitleTemplates";
import { getNoteApi } from "../../api/NoteApi";
import { UserError } from "../../api/models/UserError";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useUpdateNote } from "../../api/queries/useNoteQueries";
import { useSelectedShelfStore } from "../../zustand/useSelectedShelfStore";
import { useShelves } from "../../api/queries/shelfQueries";
import { useAllDirectoriesQuery } from "../../api/queries/directoryQueries";
import { disambiguateLabels } from "../../utils/disambiguateLabels";
import type { ShelfReply } from "../../api/models/shelf";
import type { DirectoryReply } from "../../api/models/directory";
import { Modal } from "../../components/Modal";

export interface CreateNoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Directory the new note lands in; falls back to the selected shelf. */
  currentDirectoryId?: string;
}

const shelfLabelOf = (shelf: ShelfReply): string =>
  shelf.display_name ?? shelf.slug ?? shelf.id;

const directoryLabelOf = (directory: DirectoryReply): string =>
  directory.display_name ??
  directory.name ??
  directory.slug ??
  directory.id;

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
  // Fall back to the user's selected shelf when no directory is set.
  const selectedShelfId = useSelectedShelfStore((s) => s.selectedShelfId);

  const hasCurrentDirectory =
    currentDirectoryId !== undefined && currentDirectoryId !== "root";
  // "All shelves" means there is no shelf whose rules could resolve a
  // destination, so the user has to name a shelf or a directory here.
  const needsExplicitTarget = !hasCurrentDirectory && selectedShelfId === null;

  const [targetShelfId, setTargetShelfId] = useState<string | null>(null);
  const [targetDirectoryId, setTargetDirectoryId] = useState<string | null>(
    null,
  );
  const [showTargetError, setShowTargetError] = useState(false);

  const { data: shelves, isLoading: shelvesLoading } = useShelves(
    { include_books: false },
    { enabled: needsExplicitTarget && open },
  );
  const { list: directories, isLoading: directoriesLoading } =
    useAllDirectoriesQuery(needsExplicitTarget && open);

  const shelfLabels = useMemo(
    () => disambiguateLabels(shelves ?? [], shelfLabelOf, (shelf) => shelf.id),
    [shelves],
  );
  const directoryLabels = useMemo(
    () =>
      disambiguateLabels(
        directories ?? [],
        directoryLabelOf,
        (directory) => directory.shelf_ids?.[0] ?? directory.id,
        (directory) => directory.id,
      ),
    [directories],
  );

  const selectedTargetShelf = targetShelfId
    ? (shelves?.find((shelf) => shelf.id === targetShelfId) ?? null)
    : null;
  const selectedTargetDirectory = targetDirectoryId
    ? (directories?.find((directory) => directory.id === targetDirectoryId) ??
      null)
    : null;
  const targetMissing =
    needsExplicitTarget &&
    targetShelfId === null &&
    targetDirectoryId === null;

  const resetDraft = () => {
    setTitle(note_of_date_at_hour());
    setContent("");
    setTargetShelfId(null);
    setTargetDirectoryId(null);
    setShowTargetError(false);
  };

  const pickTargetShelf = (shelf: ShelfReply | null) => {
    setTargetShelfId(shelf?.id ?? null);
    if (shelf) {
      // The API accepts either a shelf or directories, never both.
      setTargetDirectoryId(null);
      setShowTargetError(false);
    }
  };

  const pickTargetDirectory = (directory: DirectoryReply | null) => {
    setTargetDirectoryId(directory?.id ?? null);
    if (directory) {
      setTargetShelfId(null);
      setShowTargetError(false);
    }
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

    if (targetMissing) {
      setShowTargetError(true);
      return undefined;
    }

    setIsSaving(true);
    try {
      // Backend wants shelf_id OR directory_ids; use the former
      // when no directory is set. Under "All shelves" this comes from
      // the destination picker instead of the top-bar selection.
      const directoryIdsForCreate = hasCurrentDirectory
        ? [currentDirectoryId as string]
        : targetDirectoryId !== null
          ? [targetDirectoryId]
          : undefined;
      const shelfIdForCreate = hasCurrentDirectory
        ? undefined
        : (targetShelfId ?? selectedShelfId ?? undefined);

      const note = await getNoteApi().post(title, bodyForSave, {
        directory_ids: directoryIdsForCreate,
        shelf_id: shelfIdForCreate,
      });
      if (!note) {
        return undefined;
      }

      setSnackbarState({ open: true });
      updateNote({ noteId: note.id, title: note.title, content: note.content });

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

    // Don't let the close/X path silently bypass the destination rule.
    if (targetMissing) {
      setShowTargetError(true);
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
      <Modal
        open={open}
        onClose={() => void closeDialog()}
      >
        <Modal.Header
          icon={<CreateIcon fontSize="small" />}
          title="New note"
          subtitle="Save now or open fullscreen"
        />
        <Modal.Body minHeight="42vh">
        <Stack spacing={2.25} sx={{ py: 0.5 }}>
          <TextField
            placeholder="Title"
            variant="standard"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            disabled={isSaving}
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

          {needsExplicitTarget && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 3,
                border: "1px dashed",
                borderColor:
                  showTargetError && targetMissing
                    ? "error.main"
                    : theme.palette.divider,
              }}
            >
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: "center", mb: 0.25 }}
              >
                <Typography variant="subtitle2">
                  Where should this note go?
                </Typography>
                <Tooltip
                  arrow
                  placement="top"
                  title="You picked All shelves, so there is no active shelf rule to resolve a directory automatically. Pick a shelf and the note is created on it; the directory is then resolved by the shelf rule that would normally apply. Pick a directory instead to place the note there directly."
                >
                  <InfoOutlinedIcon
                    fontSize="small"
                    sx={{ color: theme.palette.text.secondary }}
                  />
                </Tooltip>
              </Stack>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mb: 1,
                  color: theme.palette.text.secondary,
                }}
              >
                Since All shelves is selected, choose a shelf or a directory.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Autocomplete<ShelfReply>
                  fullWidth
                  options={shelves ?? []}
                  loading={shelvesLoading}
                  value={selectedTargetShelf}
                  onChange={(_event, next) => pickTargetShelf(next)}
                  getOptionLabel={(shelf) =>
                    shelfLabels.get(shelf) ?? shelfLabelOf(shelf)
                  }
                  isOptionEqualToValue={(option, value) =>
                    option.id === value.id
                  }
                  disabled={isSaving}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Shelf"
                      placeholder={
                        shelvesLoading ? "Loading..." : "Pick a shelf"
                      }
                    />
                  )}
                />
                <Autocomplete<DirectoryReply>
                  fullWidth
                  options={directories ?? []}
                  loading={directoriesLoading}
                  value={selectedTargetDirectory}
                  onChange={(_event, next) => pickTargetDirectory(next)}
                  getOptionLabel={(directory) =>
                    directoryLabels.get(directory) ??
                    directoryLabelOf(directory)
                  }
                  isOptionEqualToValue={(option, value) =>
                    option.id === value.id
                  }
                  disabled={isSaving}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Directory"
                      placeholder={
                        directoriesLoading ? "Loading..." : "Pick a directory"
                      }
                    />
                  )}
                />
              </Stack>
              {showTargetError && targetMissing && (
                <FormHelperText error sx={{ mt: 0.75 }}>
                  Pick a shelf or a directory before saving this note.
                </FormHelperText>
              )}
            </Box>
          )}

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
        </Modal.Body>
        <Modal.Footer>
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
                disabled={isSaving || targetMissing}
              >
                Save &amp; open
              </Button>
            </span>
          </Tooltip>
        </Modal.Footer>
      </Modal>

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
