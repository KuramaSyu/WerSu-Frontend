import { useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Slide,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteIcon from "@mui/icons-material/Delete";
import { DirectoryFormFields } from "../DirectoryEdit/DirectoryFormFields";
import { useCreateSubdirectoryForm } from "../DirectoryCreate/Main.hook";
import { useDirectoryEditForm } from "../DirectoryEdit/Main.hook";
import { useThemeStore } from "../../zustand/useThemeStore";

export type CreateDirectoryMode = "create" | "edit";

export interface CreateDirectoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CreateDirectoryMode;
  /**
   * Edit-mode: id of the directory to edit. Required when
   * `mode === "edit"`; ignored in create mode.
   */
  directoryId?: string;
  /**
   * Create-mode: id of the directory the new one should be created
   * under. `undefined` (or "root") leaves the new directory at root.
   */
  parentId?: string;
}

/**
 * Single modal surface for both creating and editing a directory.
 *
 * Mirrors the `CreateNote` modal contract: the close action (× /
 * backdrop / Esc) is the "save" path; an empty trimmed name cancels
 * instead. A secondary "Save" button gives an explicit save entry
 * point for users who don't want to reach for the close icon.
 *
 * Mounting points:
 * - Home page FAB and left-panel "New directory" button — opens
 *   in `mode === "create"`, no parent pre-selected.
 * - Directory view "Edit directory" action — opens in
 *   `mode === "edit"`, targeted at the current directory.
 */
export const CreateDirectoryModal: React.FC<CreateDirectoryModalProps> = ({
  open,
  onOpenChange,
  mode,
  directoryId,
  parentId,
}) => {
  const { theme } = useThemeStore();
  const [snackbarState, setSnackbarState] = useState({ open: false });

  const createForm = useCreateSubdirectoryForm({
    parentId,
    onCancel: () => onOpenChange(false),
  });
  const editForm = useDirectoryEditForm({
    directoryId,
    onCancel: () => onOpenChange(false),
  });

  // Fields common to both hooks. Reading them off the matching
  // concrete hook variable keeps TypeScript happy without a cast.
  const name = mode === "create" ? createForm.name : editForm.name;
  const description =
    mode === "create" ? createForm.description : editForm.description;
  const setName = mode === "create" ? createForm.setName : editForm.setName;
  const setDescription =
    mode === "create" ? createForm.setDescription : editForm.setDescription;
  const sortedDirectories =
    mode === "create"
      ? createForm.sortedDirectories
      : editForm.sortedDirectories;
  const parentLabel =
    mode === "create" ? createForm.parentLabel : editForm.parentLabel;
  const setParent =
    mode === "create" ? createForm.setParent : editForm.setParent;
  const parentIsValid =
    mode === "create" ? createForm.parentIsValid : editForm.parentIsValid;
  const isSaving = mode === "create" ? createForm.isSaving : editForm.isSaving;
  const handleSave =
    mode === "create" ? createForm.handleSave : editForm.handleSave;

  // Edit-only fields.
  const imageUrl = mode === "edit" ? editForm.imageUrl : "";
  const setImageUrl = mode === "edit" ? editForm.setImageUrl : () => undefined;
  const readmeBody = mode === "edit" ? editForm.readmeBody : "";
  const getReadmeNoteId =
    mode === "edit" ? editForm.getReadmeNoteId : async () => null;
  const isDeleting = mode === "edit" ? editForm.isDeleting : false;
  const handleDelete =
    mode === "edit" ? () => void editForm.handleDelete() : undefined;

  // Create-only fields.
  const hasPendingImage =
    mode === "create" ? createForm.hasPendingImage : false;
  const imagePreviewUrl = mode === "create" ? createForm.imagePreviewUrl : null;
  const setPendingImageFile =
    mode === "create" ? createForm.setPendingImageFile : () => undefined;

  // Empty trimmed name = cancel (matches `CreateNote`'s empty-content
  // contract). The user dismissed the modal without putting anything
  // meaningful in, so we don't want to POST an empty record.
  const isNameEmpty = name.trim() === "";
  const isBusy = isSaving || isDeleting;

  const closeDialog = async () => {
    if (isNameEmpty) {
      onOpenChange(false);
      return;
    }
    // Both create and edit hooks navigate on success (to the new
    // directory or back to `/d/:id`); closing the modal here just
    // needs to follow their lead.
    await handleSave();
    setSnackbarState({ open: true });
    onOpenChange(false);
  };

  const saveAndView = async () => {
    await handleSave();
    setSnackbarState({ open: true });
    onOpenChange(false);
  };

  const title = mode === "create" ? "New directory" : "Edit directory";
  const subtitle =
    mode === "create"
      ? "Save now or jump straight into the new directory"
      : "Update name, description, image, and parent directory";

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
              <CreateNewFolderIcon fontSize="small" />
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
                {title}
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: "0.78rem",
                  color: theme.palette.text.secondary,
                }}
              >
                {subtitle}
              </Box>
            </Box>
          </Box>

          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Save and open">
              <span>
                <IconButton
                  onClick={() => void saveAndView()}
                  size="small"
                  aria-label="Save and open directory"
                  disabled={isBusy || isNameEmpty}
                >
                  <CreateNewFolderIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton
                onClick={() => void closeDialog()}
                size="small"
                aria-label="Close create directory dialog"
                disabled={isBusy}
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
            minHeight: "32vh",
            px: 2.5,
            py: 2.5,
          }}
        >
          {mode === "create" ? (
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
              parentLabel={parentLabel}
              onParentChange={setParent}
              parentIsValid={parentIsValid}
            />
          ) : (
            <DirectoryFormFields
              title="Directory details"
              subtitle="Update name, description, image, and parent directory."
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
              parentLabel={parentLabel}
              onParentChange={setParent}
              parentIsValid={parentIsValid}
              showImageUrlField
              readmeBody={readmeBody}
              getReadmeNoteId={getReadmeNoteId}
            />
          )}

          {(isSaving || isDeleting) && (
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", mt: 2 }}
            >
              <CircularProgress size={16} />
              <Typography variant="body2" color="textSecondary">
                {isDeleting ? "Deleting..." : "Saving..."}
              </Typography>
            </Stack>
          )}

          {mode === "edit" && (
            <Alert
              severity="info"
              sx={{ mt: 2 }}
              action={
                handleDelete ? (
                  <IconButton
                    color="error"
                    onClick={handleDelete}
                    disabled={isBusy}
                    aria-label="Delete this directory"
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                ) : undefined
              }
            >
              WerSu stores the directory's description and image as a README.md
              note inside this directory. The header is regenerated on every
              save from these fields.
            </Alert>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbarState.open}
        onClose={() => setSnackbarState({ open: false })}
        slots={{ transition: Slide }}
        message={mode === "create" ? "Directory created" : "Directory saved"}
        autoHideDuration={1200}
      />
    </>
  );
};

export default CreateDirectoryModal;
