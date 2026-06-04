import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import type {
  Note,
  PermissionRelationshipReply,
} from "../../api/models/search";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import type { ListDirectoriesQuery } from "../../api/DirectoryApi";
import { NoteApi } from "../../api/NoteApi";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import { useUsersStore } from "../../zustand/userStore";
import {
  DirectoryHierarchyBuilder,
  type HirarchyItem,
} from "../../models/HirarchyItem";
import { RecentActivityPanel } from "../../components/RecentActivityPanel";
import { LeftPanel } from "../MainPage/LeftPanel";
import { NoteActionPanel } from "./NoteActionPanel";

const ROOT_PARENT_ID = "root";

interface ParentDirectoryPath {
  id: string;
  label: string;
}

interface PermissionSection {
  label: string;
  users: string[];
}

interface NoteSidePanelProps {
  note?: Note;
  noteId?: string;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onNoteUpdated: (note: Note) => void;
}

/**
 * Formats an ISO timestamp into a user-friendly local date/time string.
 * Falls back to the raw input if parsing fails.
 */
const formatTimestamp = (iso?: string): string => {
  if (!iso) {
    return "Unknown";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

/**
 * Resolves a path from the root node to a target node id.
 * Returns an empty array when the id is not found.
 */
const findPathById = (root: HirarchyItem, id: string): HirarchyItem[] => {
  if (root.getId() === id) {
    return [root];
  }

  for (const child of root.getChildren()) {
    const path = findPathById(child, id);
    if (path.length > 0) {
      return [root, ...path];
    }
  }

  return [];
};

/**
 * Normalizes permission relation labels for display.
 */
const normalizePermissionRelation = (relation: string): string => {
  const normalized = relation.replace(/_/g, " ").trim();
  if (!normalized) {
    return "Unknown";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

/**
 * Extracts unique parent directory ids from permission relationships.
 */
const getParentDirectoryIds = (
  permissions?: PermissionRelationshipReply[],
): string[] => {
  if (!permissions) {
    return [];
  }

  const ids = permissions
    .filter(
      (permission) =>
        (permission.relation === "parent" ||
          permission.relation === "parent_directory") &&
        permission.subject.object_type === "PERMISSION_OBJECT_TYPE_DIRECTORY",
    )
    .map((permission) => permission.subject.object_id);

  return [...new Set(ids)];
};

export const NoteSidePanel: React.FC<NoteSidePanelProps> = ({
  note,
  noteId,
  open,
  setOpen,
  onNoteUpdated,
}) => {
  const navigate = useNavigate();
  const { setMessage } = useInfoStore();
  const { directoriesById, setDirectories } = useDirectoryStore();
  const { users } = useUsersStore();
  const [isUpdatingParent, setIsUpdatingParent] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState(ROOT_PARENT_ID);

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

  // Build directory tree for resolving parent paths in the metadata panel.
  const directoryHierarchy = useMemo(
    () => new DirectoryHierarchyBuilder(directoriesById).build("Stacks"),
    [directoriesById],
  );

  // Track the parent directory ids for the current note.
  const parentDirectoryIds = useMemo(
    () => getParentDirectoryIds(note?.permissions),
    [note?.permissions],
  );

  const currentParentId = useMemo(
    () => parentDirectoryIds[0] ?? ROOT_PARENT_ID,
    [parentDirectoryIds],
  );

  useEffect(() => {
    setSelectedParentId(currentParentId);
  }, [currentParentId]);

  // Resolve human-readable parent directory paths for display chips.
  const parentDirectoryPaths = useMemo<ParentDirectoryPath[]>(() => {
    if (parentDirectoryIds.length === 0) {
      return [];
    }

    return parentDirectoryIds.map((directoryId) => {
      const path = findPathById(directoryHierarchy, directoryId);
      if (path.length === 0) {
        return {
          id: directoryId,
          label: directoryId,
        };
      }

      return {
        id: directoryId,
        label: path.map((segment) => segment.getName()).join(" / "),
      };
    });
  }, [directoryHierarchy, parentDirectoryIds]);

  // Group user permissions by relation (owner/admin/writer/reader, etc.).
  const permissionSections = useMemo<PermissionSection[]>(() => {
    const groups: Record<string, string[]> = {};
    const permissions = note?.permissions ?? [];

    permissions.forEach((permission) => {
      const relation = permission.relation;
      if (relation === "parent" || relation === "parent_directory") {
        return;
      }

      const isUserSubject =
        permission.subject.object_type === "PERMISSION_OBJECT_TYPE_USER" ||
        permission.subject.object_type === "user";

      if (!isUserSubject) {
        return;
      }

      if (!groups[relation]) {
        groups[relation] = [];
      }
      groups[relation].push(permission.subject.object_id);
    });

    return Object.entries(groups)
      .map(([relation, userIds]) => ({
        label: normalizePermissionRelation(relation),
        users: [...new Set(userIds)].map(
          (userId) => users[userId]?.username ?? userId,
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [note?.permissions, users]);

  const selectableDirectories = useMemo(() => {
    return Object.values(directoriesById)
      .filter((directory) => directory.id !== currentParentId)
      .sort((a, b) =>
        (a.display_name ?? a.name).localeCompare(b.display_name ?? b.name),
      );
  }, [directoriesById, currentParentId]);

  const handleChangeParentDirectory = async () => {
    if (!noteId) {
      return;
    }

    setIsUpdatingParent(true);
    try {
      const api = new NoteApi();
      const nextParentId =
        selectedParentId === ROOT_PARENT_ID ? undefined : selectedParentId;
      const updated = await api.patchDirectory(noteId, nextParentId);
      if (!updated) {
        setMessage(
          new SnackbarUpdateImpl("Failed to update parent directory", "error"),
        );
        return;
      }

      const refreshedNote = await api.get(noteId);
      if (refreshedNote) {
        onNoteUpdated(refreshedNote);
      }

      setMessage(new SnackbarUpdateImpl("Parent directory updated", "success"));
      setMoveDialogOpen(false);
    } catch (error) {
      console.error("Failed to update parent directory", error);
      setMessage(
        new SnackbarUpdateImpl("Failed to update parent directory", "error"),
      );
    } finally {
      setIsUpdatingParent(false);
    }
  };

  return (
    <>
      <LeftPanel open={open} setOpen={setOpen}>
        <Stack spacing={2} sx={{ p: 2 }}>
          <NoteActionPanel
            isLoading={!note}
            lastEditedLabel={formatTimestamp(note?.updated_at)}
            parentDirectories={parentDirectoryPaths}
            permissionSections={permissionSections}
            onNavigateToDirectory={(directoryId) =>
              navigate(`/d/${directoryId}`)
            }
            onChangeParentClick={() => setMoveDialogOpen(true)}
            canChangeParent={Boolean(note && noteId)}
          />

          <Divider sx={{ opacity: 0.3 }} />

          <RecentActivityPanel
            target={noteId ? { type: "note", id: noteId } : { type: "root" }}
          />
        </Stack>
      </LeftPanel>

      <Dialog
        open={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Change parent directory</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Choose a new parent directory for this note.
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="note-parent-label">Parent</InputLabel>
              <Select
                labelId="note-parent-label"
                label="Parent"
                value={selectedParentId}
                onChange={(event) =>
                  setSelectedParentId(String(event.target.value))
                }
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
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setMoveDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleChangeParentDirectory()}
            disabled={
              !note || isUpdatingParent || selectedParentId === currentParentId
            }
          >
            {isUpdatingParent ? "Updating..." : "Update"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
