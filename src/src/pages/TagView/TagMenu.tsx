import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import type { TagReply } from "../../api/models/tag";
import { useUpdateTag } from "../../api/queries/tagQueries";
import { slugify } from "../../utils/slugify";

interface TagEditDialogProps {
  tag: TagReply;
  onClose: () => void;
}

/**
 * Edit dialog for a tag's display name and slug. Mounted only while
 * open so each session starts from the current server values.
 */
const TagEditDialog: React.FC<TagEditDialogProps> = ({ tag, onClose }) => {
  const [displayName, setDisplayName] = useState(tag.display_name);
  const [slug, setSlug] = useState(tag.slug);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: updateTag, isPending } = useUpdateTag();

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setSlug(value);
  };

  const handleSubmit = async () => {
    const nextDisplayName = displayName.trim();
    if (!nextDisplayName) {
      setError("A tag needs a display name.");
      return;
    }

    const nextSlug = slug.trim() || slugify(nextDisplayName);
    setError(null);
    try {
      await updateTag({
        id: tag.id,
        payload: { display_name: nextDisplayName, slug: nextSlug },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tag.");
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit tag</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="textSecondary">
            Tags are shared across every note. Renaming one updates all of
            them.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Display name"
            value={displayName}
            onChange={(event) => handleDisplayNameChange(event.target.value)}
          />
          <TextField
            fullWidth
            label="Slug"
            value={slug}
            onChange={(event) => handleSlugChange(event.target.value)}
            helperText="Unique, machine-readable identifier."
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={isPending || displayName.trim().length === 0}
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface TagMenuProps {
  tag?: TagReply;
}

/** 3-dot menu next to the tag heading. */
export const TagMenu: React.FC<TagMenuProps> = ({ tag }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const closeMenu = () => setAnchorEl(null);

  return (
    <>
      <IconButton
        size="small"
        aria-label="Tag actions"
        disabled={!tag}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          disabled={!tag}
          onClick={() => {
            closeMenu();
            setEditOpen(true);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit tag</ListItemText>
        </MenuItem>
      </Menu>

      {editOpen && tag && (
        <TagEditDialog tag={tag} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
};

export default TagMenu;
