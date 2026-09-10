import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { M3, M4 } from "../../statics";
import { DirectoryFormFields } from "./DirectoryFormFields";
import { useDirectoryEditForm } from "./Main.hook";

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
    parentIds,
    setParentIds,
    parentIsValid,
    shelves,
    shelfIds,
    setShelfIds,
    readmeBody,
    getReadmeNoteId,
    isSaving,
    isDeleting,
    handleSave,
    handleDelete,
    handleCancel,
    hasDirectoryId,
  } = useDirectoryEditForm();

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
          {/* <Typography variant="body2" color="textSecondary">
            Update name, description, image, parent, and shelves.
          </Typography> */}
        </Stack>

        <DirectoryFormFields
          title="Directory details"
          subtitle=""
          name={name}
          description={description}
          imageUrl={imageUrl}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onImageUrlChange={setImageUrl}
          hasPendingImage={false}
          imagePreviewUrl={null}
          onPendingImageFile={() => undefined}
          sortedDirectories={sortedDirectories}
          parentIds={parentIds}
          onParentChange={setParentIds}
          parentIsValid={parentIsValid}
          shelves={shelves}
          shelfIds={shelfIds}
          onShelfChange={setShelfIds}
          showImageUrlField
          readmeBody={readmeBody}
          getReadmeNoteId={getReadmeNoteId}
        />

        <Divider />

        {/* <Alert severity="info">
          WerSu stores the directory's description and image as a README.md note
          inside this directory. The header is regenerated on every save from
          these fields.
        </Alert> */}

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
