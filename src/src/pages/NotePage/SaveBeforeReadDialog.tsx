import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

export interface SaveBeforeReadDialogProps {
  open: boolean;
  /** Disables the actions and shows a spinner while the save is in flight. */
  saving: boolean;
  /** Persist the note, then switch to read mode. */
  onSave: () => void;
  /** Switch to read mode without persisting; the edits stay in the editor. */
  onSkipSave: () => void;
  /** Close the dialog and stay in edit mode. */
  onCancel: () => void;
}

/**
 * Mobile-only prompt shown when the user leaves write mode for read
 * mode. On mobile there is no top bar (and therefore no Save button),
 * so this is the last chance to persist an edited note before the
 * editor returns to its non-editable presentation.
 */
export const SaveBeforeReadDialog: React.FC<SaveBeforeReadDialogProps> = ({
  open,
  saving,
  onSave,
  onSkipSave,
  onCancel,
}) => (
  <Dialog
    open={open}
    onClose={saving ? undefined : onCancel}
    maxWidth="xs"
    fullWidth
    data-testid="save-before-read-dialog"
  >
    <DialogTitle>Save your changes?</DialogTitle>
    <DialogContent>
      <DialogContentText>
        You are about to leave edit mode. Do you want to save your changes
        first?
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button onClick={onSkipSave} disabled={saving}>
        Don't save
      </Button>
      <Button
        variant="contained"
        onClick={onSave}
        disabled={saving}
        startIcon={
          saving ? <CircularProgress size={16} color="inherit" /> : undefined
        }
      >
        Save
      </Button>
    </DialogActions>
  </Dialog>
);
