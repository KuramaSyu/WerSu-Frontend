import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNoteVisibilityStore } from "../../zustand/useNoteVisibilityStore";
import type { NoteVisibilityTarget } from "../../api/models/noteVisibility";
import { endOfLocalDay, isoDateAfterDays } from "./visibilityDate";

export interface VisibilityCustomDialogProps {
  open: boolean;
  target: NoteVisibilityTarget | null;
  scope: number;
  date: string;
  onDateChange: (value: string) => void;
  onClose: () => void;
}

/** Date picker for a custom hide window. */
export const VisibilityCustomDialog: React.FC<VisibilityCustomDialogProps> = ({
  open,
  target,
  scope,
  date,
  onDateChange,
  onClose,
}) => {
  const hideTarget = useNoteVisibilityStore((state) => state.hideTarget);
  // Captured once per mount so render stays pure.
  const [today] = useState(() => isoDateAfterDays(0));

  const expiry = endOfLocalDay(date);
  const valid = expiry !== undefined && date >= today;

  const handleConfirm = () => {
    if (!target || !expiry || expiry.getTime() <= Date.now()) {
      return;
    }
    hideTarget(target, scope, { until: expiry });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Hide until</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {target?.kind === "directory"
              ? "This book/chapter"
              : "This note"}{" "}
            will be hidden from the selected lists until the end of the
            chosen day.
          </Typography>
          <TextField
            label="Hide until"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            error={!valid}
            helperText={valid ? undefined : "Pick a date in the future."}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={!valid}>
          Hide
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VisibilityCustomDialog;