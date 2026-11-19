import { useMemo, useState } from "react";
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { slugify } from "../../../utils/slugify";

export interface TagOption {
  id: string;
  label: string;
  slug?: string;
}

interface ManageTagsDialogProps {
  open: boolean;
  isUpdating: boolean;
  /** Every tag that can still be added to this note. */
  availableTags: TagOption[];
  /** Adds an existing tag (by id) to the note. */
  onAddTag: (tagId: string) => void;
  /** Creates a brand-new tag and adds it to the note. */
  onCreateTag: (displayName: string) => void;
  onCancel: () => void;
}

/**
 * Add-tag dialog. Mirrors the parent-directory dialog: pick an
 * existing option, or type a new label to create one on the fly.
 */
export const ManageTagsDialog: React.FC<ManageTagsDialogProps> = ({
  open,
  isUpdating,
  availableTags,
  onAddTag,
  onCreateTag,
  onCancel,
}) => {
  const [selection, setSelection] = useState<TagOption | string | null>(null);

  const typedLabel = typeof selection === "string" ? selection.trim() : "";

  const resolvedExisting = useMemo(() => {
    if (selection === null) {
      return undefined;
    }
    if (typeof selection !== "string") {
      return selection;
    }
    const slug = slugify(typedLabel);
    return availableTags.find(
      (tag) =>
        tag.label.toLowerCase() === typedLabel.toLowerCase() ||
        (tag.slug ?? "").toLowerCase() === slug,
    );
  }, [availableTags, selection, typedLabel]);

  const canConfirm =
    !isUpdating &&
    (resolvedExisting !== undefined || typedLabel.length > 0);

  const handleConfirm = () => {
    if (resolvedExisting) {
      onAddTag(resolvedExisting.id);
      return;
    }
    if (typedLabel.length > 0) {
      onCreateTag(typedLabel);
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Manage tags</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="textSecondary">
            Pick an existing tag, or type a new label to create one. You can
            remove a tag from this note with the × on its chip.
          </Typography>
          <Autocomplete<TagOption, false, false, true>
            freeSolo
            autoSelect
            options={availableTags}
            value={selection}
            onChange={(_event, next) => setSelection(next)}
            getOptionLabel={(option) =>
              typeof option === "string" ? option : option.label
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tag"
                placeholder="Type to filter or create"
                autoFocus
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          {isUpdating
            ? "Updating..."
            : resolvedExisting
              ? "Add"
              : "Create & add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
