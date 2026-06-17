import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import {
  DirectoryApi,
  type ListDirectoriesQuery,
} from "../../api/DirectoryApi";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { M3, M4, M5 } from "../../statics";
import TopBar from "../../components/TopBar";

const ROOT_PARENT_ID = "root";

export const DirectoryEditPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { directoriesById, setDirectories, upsertDirectory, removeDirectory } =
    useDirectoryStore();
  const { setMessage } = useInfoStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>(ROOT_PARENT_ID);
  const [imageUrl, setImageUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const directoryListQuery = useMemo<ListDirectoriesQuery>(
    () => ({ limit: 500, offset: 0 }),
    [],
  );
  const { data: directories } = useDirectoriesQuery(directoryListQuery, true);

  useEffect(() => {
    if (directories) {
      setDirectories(directories);
    }
  }, [directories, setDirectories]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const cached = directoriesById[id];
    if (cached) {
      setName(cached.display_name ?? cached.name);
      setDescription(cached.description ?? "");
      setParentId(cached.parent_id ?? ROOT_PARENT_ID);
      setImageUrl(cached.image_url ?? "");
      return;
    }

    const load = async () => {
      const directory = await new DirectoryApi().get(id);
      if (!directory) {
        setMessage(new SnackbarUpdateImpl("Failed to load directory", "error"));
        return;
      }
      upsertDirectory(directory);
      setName(directory.display_name ?? directory.name);
      setDescription(directory.description ?? "");
      setParentId(directory.parent_id ?? ROOT_PARENT_ID);
      setImageUrl(directory.image_url ?? "");
    };

    void load();
  }, [id, directoriesById, setMessage, upsertDirectory]);

  const handleSave = async () => {
    if (!id) {
      return;
    }

    if (id === ROOT_PARENT_ID) {
      setMessage(
        new SnackbarUpdateImpl("Root directory cannot be edited", "info"),
      );
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage(new SnackbarUpdateImpl("Name is required", "warning"));
      return;
    }

    const current = directoriesById[id];
    const nextParentId = parentId === ROOT_PARENT_ID ? null : parentId;

    setIsSaving(true);
    try {
      const shouldPatchDetails =
        !current ||
        trimmedName !== (current.display_name ?? current.name) ||
        description !== (current.description ?? "");

      if (shouldPatchDetails) {
        const updated = await new DirectoryApi().patch({
          id,
          display_name: trimmedName,
          description: description || undefined,
        });

        if (!updated) {
          setMessage(
            new SnackbarUpdateImpl("Failed to update directory", "error"),
          );
          return;
        }

        upsertDirectory(updated);
      }

      const parentChanged =
        (current?.parent_id ?? ROOT_PARENT_ID) !==
        (nextParentId ?? ROOT_PARENT_ID);

      if (parentChanged) {
        const updatedParent = await new DirectoryApi().setParent(
          id,
          nextParentId,
        );

        if (!updatedParent) {
          setMessage(
            new SnackbarUpdateImpl(
              "Directory updated, but failed to move directory",
              "warning",
            ),
          );
          return;
        }

        upsertDirectory(updatedParent);
      }

      setMessage(new SnackbarUpdateImpl("Directory saved", "success"));
      navigate(`/d/${id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || id === ROOT_PARENT_ID) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this directory? Notes inside may become unassigned.",
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      const deleted = await new DirectoryApi().delete(id);
      if (!deleted) {
        setMessage(
          new SnackbarUpdateImpl("Failed to delete directory", "error"),
        );
        return;
      }

      removeDirectory(id);
      setMessage(new SnackbarUpdateImpl("Directory deleted", "success"));
      navigate("/");
    } finally {
      setIsDeleting(false);
    }
  };

  const selectableDirectories = useMemo(() => {
    return Object.values(directoriesById)
      .filter((directory) => directory.id !== id)
      .sort((a, b) =>
        (a.display_name ?? a.name).localeCompare(b.display_name ?? b.name),
      );
  }, [directoriesById, id]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      <TopBar scrollContainer={null} />
      <Box
        sx={{
          pt: `calc(${M5} + ${M4})`,
          px: M5,
          pb: M5,
          color: "textPrimary",
        }}
      >
        <Stack
          spacing={M4}
          sx={{
            maxWidth: 640,
          }}
        >
          <Stack spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              Edit directory
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Update name, description, and parent directory.
            </Typography>
          </Stack>

          <Stack spacing={M3}>
            <TextField
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
            />
            <TextField
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
            <TextField
              label="Directory image (coming soon)"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              disabled
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="directory-parent-label">Parent</InputLabel>
              <Select
                labelId="directory-parent-label"
                label="Parent"
                value={parentId}
                onChange={(event) => setParentId(String(event.target.value))}
              >
                <MenuItem value={ROOT_PARENT_ID}>Root</MenuItem>
                {selectableDirectories.map((directory) => (
                  <MenuItem key={directory.id} value={directory.id}>
                    {directory.display_name ?? directory.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Divider />

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={() => void handleSave()}
              disabled={isSaving || !id}
            >
              Save changes
            </Button>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="outlined"
              color="error"
              onClick={() => void handleDelete()}
              disabled={isDeleting || !id}
            >
              Delete directory
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};
