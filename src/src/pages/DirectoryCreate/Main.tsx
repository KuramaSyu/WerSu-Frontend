import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { M3, M4 } from "../../statics";
import { DirectoryFormFields } from "../DirectoryEdit/DirectoryFormFields";
import { useCreateSubdirectoryForm } from "./Main.hook";

/**
 * The form body. Lives in its own component so the parent page can
 * `key` it on the route `:id`; navigating from the right panel of
 * directory A's view to directory B's Create page forces a full
 * remount, which re-initializes `useCreateSubdirectoryForm` (and the
 * `useDirectoryFormShell` / `useParentIds` hooks it composes) from
 * the new route's data.
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
    parentIds,
    setParentIds,
    parentIsValid,
    shelves,
    shelfIds,
    setShelfIds,
    hasPendingImage,
    imagePreviewUrl,
    setPendingImageFile,
    isSaving,
    isUploadingImage,
    handleSave,
    handleCancel,
  } = useCreateSubdirectoryForm();

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

        <DirectoryFormFields
          title="Directory details"
          subtitle="Configure the new directory. The parent is pre-selected with the directory you came from."
          name={name}
          description={description}
          imageUrl=""
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onImageUrlChange={() => undefined}
          hasPendingImage={hasPendingImage}
          imagePreviewUrl={imagePreviewUrl}
          onPendingImageFile={setPendingImageFile}
          sortedDirectories={sortedDirectories}
          parentIds={parentIds}
          onParentChange={setParentIds}
          parentIsValid={parentIsValid}
          shelves={shelves}
          shelfIds={shelfIds}
          onShelfChange={setShelfIds}
        />

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
              {isUploadingImage ? "Uploading image..." : "Creating..."}
            </Typography>
          </Stack>
        )}
      </Stack>
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
