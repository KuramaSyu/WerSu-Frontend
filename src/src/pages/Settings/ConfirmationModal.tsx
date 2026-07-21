import type React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CircularProgress,
  Dialog,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";

export interface ConfirmationModalProps {
  /** Bold title shown in the dialog header. */
  title: string;
  /**
   * Body content explaining what the user is confirming. A plain
   * string is rendered as-is; structured JSX (e.g. a list of
   * cascade-affected items) is also accepted.
   */
  message: React.ReactNode;
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
  /**
   * While true, the confirm button shows a spinner, the cancel
   * button is disabled, and `onCancel` is suppressed so the dialog
   * stays open across an in-flight async action. Defaults to false.
   */
  confirming?: boolean;
  /**
   * When set, rendered as a red alert inside the body. Use this to
   * surface an inline error from the async action so the user can
   * retry without dismissing the dialog.
   */
  errorMessage?: string | null;
  /**
   * MUI `maxWidth` for the underlying `Dialog`. Defaults to `xs`
   * for short confirmations; pass `sm`/`md` when the `message` is
   * structured (e.g. a cascade preview list).
   */
  maxWidth?: "xs" | "sm" | "md";
}

/**
 * Tiny confirm-or-cancel dialog built on top of MUI `Dialog` + `Card`.
 *
 * Used by the settings page to gate destructive `reset` actions behind
 * a single click of explicit user intent. Pass `confirming` and
 * `errorMessage` for the "stay open with a spinner on the confirm
 * button, then show the error inline" pattern.
 */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
  open,
  confirmLabel = "Yes",
  cancelLabel = "No",
  confirming = false,
  errorMessage = null,
  maxWidth = "xs",
}) => {
  // Disable the backdrop click + Escape while a destructive action
  // is in flight; otherwise the user can cancel mid-delete and leave
  // the server in a half-finished state.
  const handleClose = confirming ? undefined : onCancel;
  return (
    <Dialog open={open} onClose={handleClose} maxWidth={maxWidth} fullWidth>
      <Card>
        <CardHeader title={title} />
        <CardContent>
          <Box>{message}</Box>
          {errorMessage && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {errorMessage}
            </Alert>
          )}
        </CardContent>
        <CardActions sx={{ justifyContent: "flex-end" }}>
          {/* Cancel sits on the left side of the action group so the
              destructive Delete button stays as the rightmost (most
              decisive) affordance. */}
          <Button
            variant="contained"
            onClick={onCancel}
            disabled={confirming}
            startIcon={<CloseIcon />}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={onConfirm}
            disabled={confirming}
            // While in-flight the spinner replaces the icon so the
            // button width stays stable.
            startIcon={
              confirming ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DeleteIcon />
              )
            }
          >
            {confirming ? `${confirmLabel}...` : confirmLabel}
          </Button>
        </CardActions>
      </Card>
    </Dialog>
  );
};
