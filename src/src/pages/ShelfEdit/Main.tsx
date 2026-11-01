import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useShelf, useUpdateShelf } from "../../api/queries/shelfQueries";
import type { ShelfReply } from "../../api/models/shelf";
import { useLeftPanel, usePanelSize, useRightPanel } from "../../LayoutProvider";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { ShelfEditPanel } from "./ShelfEditPanel";
import { ShelfThemeSection } from "./ShelfThemeSection";

/**
 * Form body. Mounted only once the shelf has loaded (and keyed on its
 * id), so initial state can be seeded from props without an effect.
 */
const ShelfEditForm: React.FC<{ shelf: ShelfReply }> = ({ shelf }) => {
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
      spacing={3}
      sx={{ p: 3, maxWidth: 720, width: "100%" }}
    >
      <Stack spacing={0.5}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Edit shelf
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

/**
 * Route entry for `/shelves/:shelfId/edit`. Mounts the left rail anchor
 * and keys the form on the shelf id so navigating between shelves
 * remounts the form state.
 */
export const ShelfEditPage: React.FC = () => {
  const params = useParams<{ shelfId: string }>();
  const shelfId = params.shelfId ?? "";
  const navigate = useNavigate();
  const shelfQuery = useShelf({ id: shelfId, include_books: false });

  usePanelSize({ left: "clamp(18rem, 22vw, 26rem)" });
  useRightPanel(null);
  useLeftPanel(
    <ShelfEditPanel
      shelf={shelfQuery.data ?? null}
      isLoading={shelfQuery.isLoading}
      onBack={() => navigate("/")}
      onOpenRules={() => navigate(`/shelves/${shelfId}/rules`)}
    />,
    [shelfId, shelfQuery.data, shelfQuery.isLoading],
  );

  if (!shelfId) {
    return (
      <Stack
        sx={{ height: "100%", alignItems: "center", justifyContent: "center" }}
        spacing={2}
      >
        <Alert severity="warning">No shelf selected.</Alert>
        <Button variant="outlined" onClick={() => navigate("/")}>
          Go home
        </Button>
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {shelfQuery.data === undefined ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          {shelfQuery.isError ? (
            <Alert severity="error">
              {shelfQuery.error instanceof Error
                ? shelfQuery.error.message
                : "Failed to load shelf"}
            </Alert>
          ) : (
            <CircularProgress />
          )}
        </Box>
      ) : (
        <ShelfEditForm key={shelfQuery.data.id} shelf={shelfQuery.data} />
      )}
    </Box>
  );
};

export default ShelfEditPage;
