import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Dialog,
} from "@mui/material";

export interface ConfirmationModalProps {
  /** Bold title shown in the dialog header. */
  title: string;
  /** Body text explaining what the user is confirming. */
  message: string;
  /** Fired when the user picks `Yes`. */
  onConfirm: () => void;
  /** Fired when the user picks `No` or dismisses the dialog. */
  onCancel: () => void;
  /** Controls open/closed state. */
  open: boolean;
  /** Label for the confirm button. Defaults to "Yes". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "No". */
  cancelLabel?: string;
}

/**
 * Tiny confirm-or-cancel dialog built on top of MUI `Dialog` + `Card`.
 *
 * Used by the settings page to gate destructive `reset` actions behind
 * a single click of explicit user intent.
 */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
  open,
  confirmLabel = "Yes",
  cancelLabel = "No",
}) => {
  return (
    <Dialog open={open} onClose={onCancel}>
      <Card>
        <CardHeader title={title} />
        <CardContent>{message}</CardContent>
        <CardActions>
          <Button variant="contained" color="error" onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="contained" color="success" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </CardActions>
      </Card>
    </Dialog>
  );
};
