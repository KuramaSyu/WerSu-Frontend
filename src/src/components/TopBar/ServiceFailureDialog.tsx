import React from "react";
import { Alert, Button, DialogContentText, Stack } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import SettingsIcon from "@mui/icons-material/Settings";
import CloseIcon from "@mui/icons-material/Close";
import { ModalShell } from "../ModalShell";

export interface ServiceFailureDialogProps {
  /** Whether the dialog is open; the parent owns open/close state. */
  open: boolean;
  /** Labels of unreachable services. Empty array -> generic copy. */
  unreachableServices: readonly string[];
  /** Fired on title-bar X / backdrop / Escape. Treated as "Ignore". */
  onClose: () => void;
  /** Fired on the primary "Go to Settings" action. */
  onGoToSettings: () => void;
  /** Fired on the secondary "Ignore" action. */
  onIgnore: () => void;
}

/**
 * One-shot modal surfaced the first time a backend service is
 * unreachable. Two exits: "Go to Settings" jumps to the admin
 * panel; "Ignore" dismisses and the red dot stays as the ambient
 * indicator. X / backdrop / Escape route through `onClose` and
 * are treated identically to "Ignore".
 */
export const ServiceFailureDialog: React.FC<ServiceFailureDialogProps> = ({
  open,
  unreachableServices,
  onClose,
  onGoToSettings,
  onIgnore,
}) => {
  const hasNamed = unreachableServices.length > 0;
  const title = hasNamed
    ? "Backend services unreachable"
    : "Backend unreachable";
  const summary = hasNamed ? unreachableServices.join(", ") : "Backend";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={<ErrorOutlineIcon fontSize="small" />}
      title={title}
      subtitle={
        hasNamed
          ? "These services need to come back up for full functionality"
          : "The status endpoint could not be reached"
      }
      maxWidth="md"
      actions={
        <>
          <Button
            variant="outlined"
            startIcon={<CloseIcon fontSize="small" />}
            onClick={onIgnore}
          >
            Ignore
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SettingsIcon fontSize="small" />}
            onClick={onGoToSettings}
          >
            Go to Settings
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <DialogContentText>
          {hasNamed
            ? `Unreachable: ${summary}. It is crucial that all services run for full functionality.`
            : "All backend services need to run for the app to work."}
        </DialogContentText>
        {hasNamed && (
          <Alert severity="error" variant="outlined">
            {summary}
          </Alert>
        )}
      </Stack>
    </ModalShell>
  );
};

export default ServiceFailureDialog;
