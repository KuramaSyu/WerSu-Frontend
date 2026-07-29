import { useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Slide,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import { DirectoryFormFields } from "../DirectoryEdit/DirectoryFormFields";
import { useCreateSubdirectoryForm } from "../DirectoryCreate/Main.hook";
import { useDirectoryEditForm } from "../DirectoryEdit/Main.hook";
import { ModalShell } from "../../components/ModalShell";

export type CreateDirectoryMode = "create" | "edit";

export interface CreateDirectoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CreateDirectoryMode;
  /** Edit-mode: id of the directory to edit. Required when `mode === "edit"`. */
  directoryId?: string;
  /** Create-mode: id of the directory the new one should be created under. */
  parentId?: string;
}

/**
 * Single modal surface for both creating and editing a directory.
 *
 * Mirrors `CreateNote`'s contract: empty trimmed name cancels, save
 * otherwise. Save targets the bottom row now (moved out of the
 * header). `ModalShell` owns the icon / X / blur / round look.
 *
 * Mounting points:
 * - Home page FAB and left-panel "New directory" button — `mode === "create"`.
 * - Directory view "Edit directory" action — `mode === "edit"`.
 */
export const CreateDirectoryModal: React.FC<CreateDirectoryModalProps> = ({
  open,
  onOpenChange,
  mode,
  directoryId,
  parentId,
}) => {
  const [snackbarState, setSnackbarState] = useState({ open: false });

  const createForm = useCreateSubdirectoryForm({
    parentId,
    onCancel: () => onOpenChange(false),
  });
  const editForm = useDirectoryEditForm({
    directoryId,
    onCancel: () => onOpenChange(false),
  });

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

  const imageUrl = mode === "edit" ? editForm.imageUrl : "";
  const setImageUrl = mode === "edit" ? editForm.setImageUrl : () => undefined;
  const readmeBody = mode === "edit" ? editForm.readmeBody : "";
  const getReadmeNoteId =
    mode === "edit" ? editForm.getReadmeNoteId : async () => null;
  const isDeleting = mode === "edit" ? editForm.isDeleting : false;
  const handleDelete =
    mode === "edit" ? () => void editForm.handleDelete() : undefined;

  const hasPendingImage =
    mode === "create" ? createForm.hasPendingImage : false;
  const imagePreviewUrl = mode === "create" ? createForm.imagePreviewUrl : null;
  const setPendingImageFile =
    mode === "create" ? createForm.setPendingImageFile : () => undefined;

  const isNameEmpty = name.trim() === "";
  const isBusy = isSaving || isDeleting;

  const closeDialog = async () => {
    if (isNameEmpty) {
      onOpenChange(false);
      return;
    }
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
      <ModalShell
        open={open}
        onClose={() => void closeDialog()}
        icon={<CreateNewFolderIcon fontSize="small" />}
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {mode === "edit" && handleDelete && (
              <Tooltip title="Delete this directory">
                <span>
                  <Button
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteIcon fontSize="small" />}
                    onClick={handleDelete}
                    disabled={isBusy}
                  >
                    Delete
                  </Button>
                </span>
              </Tooltip>
            )}
            <Button
              variant="outlined"
              onClick={() => void closeDialog()}
              disabled={isBusy || isNameEmpty}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<OpenInFullIcon fontSize="small" />}
              onClick={() => void saveAndView()}
              disabled={isBusy || isNameEmpty}
            >
              Save &amp; open
            </Button>
          </>
        }
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
          <Alert severity="info" sx={{ mt: 2 }}>
            WerSu stores the directory's description and image as a README.md
            note inside this directory. The header is regenerated on every save
            from these fields.
          </Alert>
        )}
      </ModalShell>

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
