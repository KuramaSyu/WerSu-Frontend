import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { M3, M4 } from "../../statics";
import { ImageUploadModal } from "../../components/DirectoryEdit/ImageUploadModal";
import { DirectoryParentAutocomplete } from "../../components/DirectoryEdit/DirectoryParentAutocomplete";
import { useCreateSubdirectoryForm } from "./Main.hook";

/**
 * The form body. Lives in its own component so the parent page can
 * `key` it on the route `:id`; navigating from the right panel of
 * directory A's view to directory B's Create page forces a full
 * remount, which re-initializes `useCreateSubdirectoryForm` (and the
 * `useDirectoryFormShell` / `useParentSelector` hooks it composes)
 * from the new route's data.
 *
 * See `DirectoryEditForm` for the full rationale.
 */
const CreateSubdirectoryForm: React.FC = () => {
  const {
    name,
    description,
    setName,
    setDescription,
    sortedDirectories,
    parentLabel,
    setParent,
    parentIsValid,
    hasPendingImage,
    imagePreviewUrl,
    setPendingImageFile,
    isSaving,
    isUploadingImage,
    handleSave,
    handleCancel,
  } = useCreateSubdirectoryForm();

  // Local UI state — the modal's open flag is purely a presentation
  // concern. The picked `File` flows back to the hook via
  // `setPendingImageFile`.
  const [imageModalOpen, setImageModalOpen] = useState(false);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        alignItems: "center",
      }}
    >
      <Stack
        component={Paper}
        spacing={M4}
        sx={{
          p: M3,
          maxWidth: 640,
          width: "100%",
        }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Create subdirectory
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Configure the new directory. The parent is pre-selected with the
            directory you came from.
          </Typography>
        </Stack>

        <Stack spacing={M3}>
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            fullWidth
          />
          <TextField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
          <DirectoryParentAutocomplete
            directories={sortedDirectories}
            value={parentLabel}
            onChange={setParent}
            isValid={parentIsValid}
            helperText={
              parentIsValid
                ? undefined
                : `Parent directory "${parentLabel}" does not exist. Pick an option from the list or clear the field for top level.`
            }
            placeholder="Type a directory name or leave empty for top level"
          />
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            {/* Local preview of the picked file. Once a file is
                selected, we keep the URL string out of the visible UI
                (no text input) — the upload modal owns the final URL
                and writes it onto the directory on save. */}
            <TextField
              label="Directory image"
              value={
                hasPendingImage ? "Image selected (preview on the right)" : ""
              }
              placeholder="No image selected"
              fullWidth
              slotProps={{ input: { readOnly: true } }}
            />
            {imagePreviewUrl && (
              <Box
                component="img"
                src={imagePreviewUrl}
                alt="selected directory image preview"
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 1,
                  objectFit: "cover",
                  mt: 0.5,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              />
            )}
            <Tooltip title="Upload an image. WerSu uploads it, links it to the new directory's README, and writes the URL into the directory on save.">
              <span>
                <IconButton
                  color="primary"
                  onClick={() => setImageModalOpen(true)}
                  sx={{ mt: 0.5 }}
                  aria-label="upload directory image"
                >
                  <EditIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Alert severity="info">
          After creation the directory opens immediately. You can edit the
          description, image, and parent at any time from the directory view.
        </Alert>

        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={isSaving || isUploadingImage || !parentIsValid}
          >
            Create subdirectory
          </Button>
          <Button variant="outlined" onClick={handleCancel}>
            Cancel
          </Button>
        </Stack>

        {(isSaving || isUploadingImage) && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="textSecondary">
              {isUploadingImage ? "Uploading image…" : "Creating…"}
            </Typography>
          </Stack>
        )}
      </Stack>

      <ImageUploadModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        // `deferUpload` skips the modal's own upload step and just
        // hands the picked `File` back to us. We hold it in the hook
        // until the user presses Save, then upload + link + patch the
        // directory in `handleSave`.
        deferUpload
        onFilePicked={(file) => setPendingImageFile(file)}
        // The README doesn't exist yet; the modal only needs this
        // when it's running its own upload, which we disabled.
        getReadmeNoteId={async () => null}
      />
    </Box>
  );
};

/**
 * Route entry point. Reads the `:id` from the URL and renders the
 * form with that id as a React `key`, so navigating between Create
 * pages (e.g. from directory A's right panel to directory B's)
 * forces a full remount and re-seeds every field to the new
 * directory's context. See `CreateSubdirectoryForm` for the full
 * rationale.
 */
export const CreateSubdirectoryPage: React.FC = () => {
  const { id } = useParams();
  return <CreateSubdirectoryForm key={id ?? "__no_id__"} />;
};

export default CreateSubdirectoryPage;
