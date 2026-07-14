import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DirectoryApi,
  type ListDirectoriesQuery,
} from "../../api/DirectoryApi";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useDirectory } from "../../api/queries/useDirectoryQuery";
import { useDirectoryNotesQuery } from "../../api/queries/useDirectoryNotesQuery";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { M3, M4 } from "../../statics";
import { getNoteApi, type INoteApi } from "../../api/NoteApi";
import { ImageUploadModal } from "../../components/DirectoryEdit/ImageUploadModal";
import {
  README_NOTE_TITLE,
  README_SENTINEL,
  serializeReadme,
} from "../../utils/readme";
import type { MinimalNote } from "../../api/models/search";

const ROOT_PARENT_ID = "root";

/**
 * `AttachmentLinkBuilder.asMarkdown()` returns `![...](url)`. The form
 * stores the URL itself (no markdown wrapper) so it round-trips through
 * `DirectoryReply.image_url`.
 */
const extractImageUrl = (markdownUrl: string): string => {
  const match = markdownUrl.match(/!\[[^\]]*\]\(([^)]+)\)/);
  return match ? match[1] : markdownUrl;
};

const extractReadmeBody = (content: string | undefined): string => {
  if (!content) {
    return "";
  }
  const parts = content.split(README_SENTINEL);
  return parts.length > 1 ? parts.slice(1).join(README_SENTINEL).trim() : "";
};

const findReadme = (notes: MinimalNote[] | undefined): MinimalNote | null => {
  if (!notes) {
    return null;
  }
  return notes.find((note) => note.title === README_NOTE_TITLE) ?? null;
};

export const DirectoryEditPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { directoriesById, setDirectories, upsertDirectory, removeDirectory } =
    useDirectoryStore();
  const { setMessage } = useInfoStore();
  const queryClient = useQueryClient();
  const noteApi: INoteApi = getNoteApi();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>(ROOT_PARENT_ID);
  const [imageUrl, setImageUrl] = useState("");
  const [readmeNoteId, setReadmeNoteId] = useState<string | null>(null);
  const [readmeBody, setReadmeBody] = useState("");
  const [readmeHydratedFor, setReadmeHydratedFor] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

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

  // 1. Directory metadata: prefer the cached store record (kept fresh by
  //    the parent list query), fall back to a single-record fetch via the
  //    TanStack query hook. The hook owns loading state.
  const cachedDirectory = id ? directoriesById[id] : undefined;
  const { data: fetchedDirectory, isPending: isDirectoryPending } =
    useDirectory(cachedDirectory ? undefined : id);

  useEffect(() => {
    if (fetchedDirectory) {
      upsertDirectory(fetchedDirectory);
    }
  }, [fetchedDirectory, upsertDirectory]);

  const directory = cachedDirectory ?? fetchedDirectory ?? null;
  const isLoadingDirectory = !!id && isDirectoryPending && !cachedDirectory;

  // 2. README discovery. The hook fetches the directory's notes; the
  //    README (if any) is the entry with `title === "README.md"`. We
  //    hydrate form state once per directory id.
  const { data: directoryNotesReply } = useDirectoryNotesQuery(id, {
    limit: 100,
  });

  useEffect(() => {
    if (!id || !directoryNotesReply) {
      return;
    }
    if (readmeHydratedFor === id) {
      return;
    }
    const readme = findReadme(directoryNotesReply.notes);
    console.log("Hydrating README for directory", id, readme);
    setReadmeNoteId(readme?.id ?? null);
    setReadmeBody(extractReadmeBody(readme?.stripped_content));
    setReadmeHydratedFor(id);
  }, [id, directoryNotesReply, readmeHydratedFor]);

  // Reset the hydration marker when the user navigates to a different
  // directory so the next mount re-reads the README.
  useEffect(() => {
    setReadmeHydratedFor(null);
  }, [id]);

  // Seed the form from the directory record. We do this once the record
  // first arrives; subsequent edits to the form are owned by the user.
  useEffect(() => {
    if (!directory) {
      return;
    }
    setName(directory.display_name ?? directory.name ?? directory.slug ?? "");
    setDescription(directory.description ?? "");
    setParentId(directory.parent_dir_ids?.[0] ?? ROOT_PARENT_ID);
    setImageUrl(directory.image_url ?? "");
  }, [directory]);

  // Resolves the current README note id, creating the note (and assigning
  // it to this directory) when one doesn't exist. Used by the image upload
  // modal to guarantee a target for `linkAttachment` before the user has
  // pressed "Save changes" for the first time. The serialized header is
  // built from the current form state so the README that gets created
  // already reflects the user's edits.
  const getReadmeNoteId = useCallback(async (): Promise<string | null> => {
    if (!id) {
      return null;
    }
    if (readmeNoteId) {
      return readmeNoteId;
    }
    const trimmedName = name.trim() || "Untitled";
    const serializedReadme = serializeReadme(
      {
        name: trimmedName,
        description,
        imageUrl,
      },
      readmeBody,
    );
    try {
      const created = await noteApi.post(README_NOTE_TITLE, serializedReadme);
      const moved = await noteApi.patchDirectory(created.id, id);
      if (!moved) {
        setMessage(
          new SnackbarUpdateImpl(
            "README created, but failed to assign to this directory",
            "warning",
          ),
        );
        return null;
      }
      setReadmeNoteId(created.id);
      // The note list for this directory now contains the new README; let
      // any consumer re-fetch so the cache stays in sync.
      queryClient.invalidateQueries({ queryKey: ["directory", "notes", id] });
      setMessage(
        new SnackbarUpdateImpl(
          "Created README.md to link the uploaded image",
          "info",
        ),
      );
      return created.id;
    } catch (error) {
      console.error("Failed to create README note", error);
      return null;
    }
  }, [
    id,
    readmeNoteId,
    name,
    description,
    imageUrl,
    readmeBody,
    noteApi,
    queryClient,
    setMessage,
  ]);

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
    const nextParentIds = parentId === ROOT_PARENT_ID ? null : [parentId];

    const serializedReadme = serializeReadme(
      {
        name: trimmedName,
        description,
        imageUrl,
      },
      readmeBody,
    );

    setIsSaving(true);
    try {
      // 1. Persist the README note. Regenerate the header on every save;
      //    preserve the user-authored body below the sentinel.
      let nextReadmeId = readmeNoteId;
      if (nextReadmeId) {
        const patched = await noteApi.patch(
          nextReadmeId,
          README_NOTE_TITLE,
          serializedReadme,
        );
        if (!patched) {
          setMessage(
            new SnackbarUpdateImpl(
              "Directory updated, but failed to save README",
              "warning",
            ),
          );
        }
      } else {
        const created = await noteApi.post(README_NOTE_TITLE, serializedReadme);
        const moved = await noteApi.patchDirectory(created.id, id);
        if (!moved) {
          setMessage(
            new SnackbarUpdateImpl(
              "README created, but failed to assign to this directory",
              "warning",
            ),
          );
        }
        nextReadmeId = created.id;
      }

      // 2. Sync directory metadata (name / description / image_url).
      const shouldPatchDetails =
        !current ||
        trimmedName !==
          (current.display_name ?? current.name ?? current.slug) ||
        description !== (current.description ?? "") ||
        imageUrl !== (current.image_url ?? "");

      if (shouldPatchDetails) {
        const updated = await new DirectoryApi().patch({
          id,
          display_name: trimmedName,
          description: description || undefined,
          image_url: imageUrl || undefined,
        });

        if (!updated) {
          setMessage(
            new SnackbarUpdateImpl("Failed to update directory", "error"),
          );
          return;
        }

        upsertDirectory(updated);
      }

      // 3. Move the directory if the parent changed.
      const currentParentId = current?.parent_dir_ids?.[0] ?? ROOT_PARENT_ID;
      const nextParentId =
        nextParentIds === null ? ROOT_PARENT_ID : nextParentIds[0];
      const parentChanged = currentParentId !== nextParentId;

      if (parentChanged) {
        const updatedParent = await new DirectoryApi().setParent(
          id,
          nextParentIds,
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

      setReadmeNoteId(nextReadmeId);

      // Refresh every cache that depends on this directory's metadata or
      // its README note so the new description / image show up immediately
      // on DirectoryView, MainContent, and any open /n/<readmeId> editor.
      queryClient.invalidateQueries({ queryKey: ["directories"] });
      queryClient.invalidateQueries({ queryKey: ["directory", id] });
      queryClient.invalidateQueries({ queryKey: ["directory", "notes", id] });
      if (nextReadmeId) {
        queryClient.invalidateQueries({ queryKey: ["notes", nextReadmeId] });
      }
      queryClient.invalidateQueries({ queryKey: ["notes"] });

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
        (a.display_name ?? a.name ?? a.slug ?? a.id).localeCompare(
          b.display_name ?? b.name ?? b.slug ?? b.id,
        ),
      );
  }, [directoriesById, id]);

  if (isLoadingDirectory) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        alignItems: "center",
      }}
    >
      <Stack
        component={Paper}
        spacing={M4}
        sx={{
          p: M3,
          maxWidth: 640,
          width: "100%",
        }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Edit directory
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Update name, description, image, and parent directory.
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
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <TextField
              label="Directory image"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://..."
              fullWidth
            />
            <Tooltip title="Upload an image. WerSu writes the URL into the README header.">
              <span>
                <IconButton
                  color="primary"
                  onClick={() => setImageModalOpen(true)}
                  sx={{ mt: 0.5 }}
                  aria-label="upload directory image"
                >
                  <EditIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
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

        <Alert severity="info">
          WerSu stores the directory's description and image as a README.md note
          inside this directory. The header is regenerated on every save from
          these fields.
        </Alert>

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

      <ImageUploadModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onUploaded={(markdownUrl) => setImageUrl(extractImageUrl(markdownUrl))}
        getReadmeNoteId={getReadmeNoteId}
        currentImageUrl={imageUrl}
        readmeContent={serializeReadme(
          {
            name: name.trim() || "Untitled",
            description,
            imageUrl,
          },
          readmeBody,
        )}
      />
    </Box>
  );
};

export default DirectoryEditPage;
