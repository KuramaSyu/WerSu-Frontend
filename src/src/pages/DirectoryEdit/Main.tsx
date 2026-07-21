import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
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
import { serializeReadme } from "../../utils/readme";
import { useDirectoryEditForm } from "./Main.hook";

/**
 * `AttachmentLinkBuilder.asMarkdown()` returns `![...](url)`. The form
 * stores the URL itself (no markdown wrapper) so it round-trips
 * through `DirectoryReply.image_url`.
 */
const extractImageUrl = (markdownUrl: string): string => {
  const match = markdownUrl.match(/!\[[^\]]*\]\(([^)]+)\)/);
  return match ? match[1] : markdownUrl;
};

/**
 * The form body. Lives in its own component so the parent page can
 * `key` it on the route `:id`; when the user navigates from editing
 * directory A to editing directory B, React unmounts this component
 * and mounts a fresh one, which in turn re-initializes
 * `useDirectoryEditForm` (and the `useDirectoryFormShell` /
 * `useParentSelector` hooks it composes) from the new route's data.
 *
 * The "remount on key change" pattern is more reliable than effect-
 * based resets for two reasons: (1) it tears down every piece of
 * internal state — not just the ones we remembered to wire into a
 * reset effect — and (2) it always fires exactly once per route
 * change, regardless of intermediate state transitions. Without it
 * the form could briefly (or indefinitely, on a slow connection)
 * show the previous directory's data because React Router reuses
 * the same component instance across `:id` param changes.
 */
const DirectoryEditForm: React.FC = () => {
  const {
    isLoadingDirectory,
    name,
    description,
    imageUrl,
    setName,
    setDescription,
    setImageUrl,
    sortedDirectories,
    parentLabel,
    setParent,
    parentIsValid,
    readmeBody,
    getReadmeNoteId,
    isSaving,
    isDeleting,
    handleSave,
    handleDelete,
    handleCancel,
    hasDirectoryId,
  } = useDirectoryEditForm();

  // Local UI state — the modal's open flag is purely a presentation
  // concern. The picked `File` flow is owned by the modal.
  const [imageModalOpen, setImageModalOpen] = useState(false);

  if (isLoadingDirectory) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

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
            Edit directory
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Update name, description, image, and parent directory.
          </Typography>
        </Stack>

        <Stack spacing={M3}>
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
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
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <TextField
              label="Directory image"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://..."
              fullWidth
            />
            <Tooltip title="Upload an image. WerSu writes the URL into the README header.">
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
        </Stack>

        <Divider />

        <Alert severity="info">
          WerSu stores the directory's description and image as a README.md note
          inside this directory. The header is regenerated on every save from
          these fields.
        </Alert>

        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={isSaving || !hasDirectoryId || !parentIsValid}
          >
            Save changes
          </Button>
          <Button variant="outlined" onClick={handleCancel}>
            Cancel
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            color="error"
            onClick={() => void handleDelete()}
            disabled={isDeleting || !hasDirectoryId}
          >
            Delete directory
          </Button>
        </Stack>
      </Stack>

      <ImageUploadModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onUploaded={(markdownUrl) => setImageUrl(extractImageUrl(markdownUrl))}
        getReadmeNoteId={getReadmeNoteId}
        currentImageUrl={imageUrl}
        readmeContent={serializeReadme(
          {
            name: name.trim() || "Untitled",
            description,
            imageUrl,
          },
          readmeBody,
        )}
      />
    </Box>
  );
};

/**
 * Route entry point. Reads the `:id` from the URL and renders the form
 * with that id as a React `key`, so navigating from `/d/A/edit` to
 * `/d/B/edit` forces a full remount. See `DirectoryEditForm` for the
 * rationale.
 */
export const DirectoryEditPage: React.FC = () => {
  const { id } = useParams();
  // The `key` is intentionally the raw route id (not a derived value)
  // so any change to `:id` — even one that resolves to the same
  // directory after a redirect — triggers a remount.
  return <DirectoryEditForm key={id ?? "__no_id__"} />;
};

export default DirectoryEditPage;
