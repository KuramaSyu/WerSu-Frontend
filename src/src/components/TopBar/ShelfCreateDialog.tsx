import React, { useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  TextField,
} from "@mui/material";
import ShelvesIcon from "@mui/icons-material/Shelves";
import { Modal } from "../Modal";
import { useCreateShelf } from "../../api/queries/shelfQueries";
import type { ShelfReply } from "../../api/models/shelf";
import { useSelectedShelfStore } from "../../zustand/useSelectedShelfStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";

export interface ShelfCreateDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the newly created shelf after a successful create. */
  onCreated?: (shelf: ShelfReply) => void;
}

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

/**
 * Small create form for a new shelf. Lives behind the "Add new shelf"
 * option in the desktop top bar's shelf menu and the mobile user
 * menu's Shelf section. On success it selects the new shelf so the
 * rest of the app immediately scopes to it.
 */
export const ShelfCreateDialog: React.FC<ShelfCreateDialogProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const createShelf = useCreateShelf();
  const setSelectedShelfId = useSelectedShelfStore(
    (s) => s.setSelectedShelfId,
  );
  const setMessage = useInfoStore((s) => s.setMessage);

  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (createShelf.isPending) return;
    setError(null);
    onClose();
  };

  const handleCreate = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError("Give the shelf a name.");
      return;
    }

    // Empty slug falls back to a slugified name. If the name has no
    // Latin characters we still need a stable wire value, so use a
    // short timestamp suffix rather than blocking the create.
    const derived = slugify(slug.trim() || trimmedName);
    const resolvedSlug =
      derived || `shelf-${Date.now().toString(36)}`;

    setError(null);
    try {
      const reply = await createShelf.mutateAsync({
        slug: resolvedSlug,
        display_name: trimmedName,
        description: description.trim() || undefined,
      });

      const created = reply.shelf;
      setSelectedShelfId(created.id);
      setMessage(
        new SnackbarUpdateImpl(
          `Created “${created.display_name ?? created.slug ?? resolvedSlug}”`,
          "success",
          3,
          reply.bootstrap_result?.description,
        ),
      );
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the shelf.",
      );
    }
  };

  return (
    <Modal open={open} onClose={handleClose} maxWidth="sm">
      <Modal.Header
        icon={<ShelvesIcon />}
        title="Create shelf"
        subtitle="Shelves group books, chapters, and their rules."
      />
      <Modal.Body>
        <Stack spacing={2}>
          {error !== null && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Display name"
            size="small"
            autoFocus
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreate();
              }
            }}
            helperText="Shown in the top bar and menus."
          />

          <TextField
            label="Slug"
            size="small"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="auto-generated from the name"
            helperText="Used in URLs. Leave empty to generate one from the name."
          />

          <TextField
            label="Description"
            size="small"
            multiline
            minRows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            helperText="Optional. Appears on the shelf's edit page."
          />
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleClose} disabled={createShelf.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleCreate()}
          disabled={createShelf.isPending}
          startIcon={
            createShelf.isPending ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {createShelf.isPending ? "Creating..." : "Create shelf"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
