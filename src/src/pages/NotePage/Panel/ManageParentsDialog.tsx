import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { DirectorySelect, ROOT_PARENT_ID } from "./DirectorySelect";

interface DirectoryOption {
  id: string;
  label: string;
}

interface ManageParentsDialogProps {
  open: boolean;
  isUpdating: boolean;
  selectedParentId: string;
  parentDirectoryIds: string[];
  selectableDirectories: DirectoryOption[];
  onChangeSelectedParent: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ManageParentsDialog: React.FC<ManageParentsDialogProps> = ({
  open,
  isUpdating,
  selectedParentId,
  parentDirectoryIds,
  selectableDirectories,
  onChangeSelectedParent,
  onConfirm,
  onCancel,
}) => {
  const isRoot = selectedParentId === ROOT_PARENT_ID;
  const confirmLabel = isUpdating
    ? "Updating..."
    : isRoot
      ? "Move to Root"
      : "Add";

  const isConfirmDisabled =
    isUpdating ||
    parentDirectoryIds.includes(selectedParentId) ||
    (isRoot && parentDirectoryIds.length === 0);

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Manage parent directories</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="textSecondary">
            Pick a directory to add it as an additional parent, or choose Root
            to remove the note from all parents.
          </Typography>
          <DirectorySelect
            value={selectedParentId}
            onChange={onChangeSelectedParent}
            options={selectableDirectories}
            labelId="note-parent-label"
            id="note-parent"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={isConfirmDisabled}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
