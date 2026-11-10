import { useState } from "react";
import {
  Button,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useUpdateShelf } from "../../api/queries/shelfQueries";
import type { ShelfReply } from "../../api/models/shelf";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { ShelfThemeSection } from "./ShelfThemeSection";

export interface ShelfSettingsTabProps {
  shelf: ShelfReply;
}

/**
 * Settings panel for a shelf.
 *
 * Mounted only once the shelf has loaded (and keyed on its id by the
 * caller), so initial state can be seeded from props without an effect.
 */
export const ShelfSettingsTab: React.FC<ShelfSettingsTabProps> = ({ shelf }) => {
  const setMessage = useInfoStore((s) => s.setMessage);
  const updateShelf = useUpdateShelf();

  const [slug, setSlug] = useState(shelf.slug ?? "");
  const [displayName, setDisplayName] = useState(shelf.display_name ?? "");
  const [description, setDescription] = useState(shelf.description ?? "");

  const handleSave = async () => {
    try {
      await updateShelf.mutateAsync({
        id: shelf.id,
        slug: slug.trim(),
        display_name: displayName.trim(),
        description,
      });
      setMessage(new SnackbarUpdateImpl("Shelf updated", "success"));
    } catch (err) {
      setMessage(
        new SnackbarUpdateImpl(
          err instanceof Error ? err.message : "Could not update shelf",
          "error",
        ),
      );
    }
  };

  return (
    <Stack
      component={Paper}
      variant="outlined"
      elevation={0}
      spacing={3}
      sx={{ p: 3, width: "100%", borderRadius: 2 }}
    >
      <Stack spacing={0.5}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Shelf settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Rename the shelf, update its description, and choose a theme to share
          with its members.
        </Typography>
      </Stack>

      <Stack spacing={2}>
        <TextField
          label="Display name"
          size="small"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <TextField
          label="Slug"
          size="small"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <TextField
          label="Description"
          size="small"
          multiline
          minRows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Stack direction="row">
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={updateShelf.isPending}
          >
            {updateShelf.isPending ? "Saving..." : "Save changes"}
          </Button>
        </Stack>
      </Stack>

      <Divider />

      <ShelfThemeSection shelfId={shelf.id} />
    </Stack>
  );
};

export default ShelfSettingsTab;
