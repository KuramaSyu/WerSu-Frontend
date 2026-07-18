import { useCallback, useEffect, useMemo, useState } from "react";
import { Divider, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { Note, type NoteData } from "../../../api/models/search";
import { useDirectoriesQuery } from "../../../api/queries/directoryQueries";
import type { ListDirectoriesQuery } from "../../../api/DirectoryApi";
import useInfoStore, { SnackbarUpdateImpl } from "../../../zustand/InfoStore";
import {
  DirectoryHierarchyBuilder,
  type HirarchyItem,
} from "../../../models/HirarchyItem";
import { LeftPanel } from "../../MainPage/LeftPanel";
import { AttachmentPanelSection } from "../AttachmentPanelSection";
import { VersionInfo } from "../VersionInfo";
import { useNote } from "../../../api/queries/useNoteQueries";
import {
  NoteActionPanel,
  type ParentDirectoryPath,
  type PermissionSection,
} from "./NoteActionPanel";
import { ManageParentsDialog } from "./ManageParentsDialog";
import { ROOT_PARENT_ID } from "./DirectorySelect";

interface NoteSidePanelProps {
  note?: Note;
  noteId?: string;
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
 * Extracts unique parent directory ids from `note.directory_ids`.
 */
const getParentDirectoryIds = (directoryIds?: string[]): string[] => {
  if (!directoryIds) {
    return [];
  }
  return [...new Set(directoryIds)];
};

const EMPTY_PERMISSION_SECTIONS: PermissionSection[] = [];

/**
 * Side-panel orchestrator for the note page. Composes the metadata
 * block, attachments section, version timeline, and the dialog used to
 * add/remove parent directories.
 */
export const NoteSidePanel: React.FC<NoteSidePanelProps> = ({
  noteId,
  onNoteUpdated,
}) => {
  const { data: note } = useNote(noteId);
  const navigate = useNavigate();
  const { setMessage } = useInfoStore();

  const [isUpdatingParent, setIsUpdatingParent] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState(ROOT_PARENT_ID);

  const directoryListQuery = useMemo<ListDirectoriesQuery>(
    () => ({ limit: 500, offset: 0 }),
    [],
  );
  const { data: directories } = useDirectoriesQuery(directoryListQuery, true);
  const directoriesById = useMemo(() => {
    if (!directories || directories.length === 0) {
      return {};
    }
    const map: Record<string, (typeof directories)[0]> = {};
    for (const directory of directories ?? []) {
      map[directory.id] = directory;
    }
    return map;
  }, [directories]);

  // Build directory tree for resolving parent paths in the metadata panel.
  const directoryHierarchy = useMemo(
    () => new DirectoryHierarchyBuilder(directoriesById).build("Stacks"),
    [directoriesById],
  );

  // Track the parent directory ids for the current note.
  const parentDirectoryIds = useMemo(
    () => getParentDirectoryIds(note?.directory_ids),
    [note?.directory_ids],
  );

  // Reset the dialog's selection every time it opens so the user is
  // forced to pick a directory rather than re-confirming a stale value.
  useEffect(() => {
    if (moveDialogOpen) {
      setSelectedParentId(ROOT_PARENT_ID);
    }
  }, [moveDialogOpen]);

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

  const selectableDirectories = useMemo(() => {
    // Multi-parent: exclude every directory that is already a parent so
    // the user cannot add a duplicate.
    const excluded = new Set(parentDirectoryIds);
    return Object.values(directoriesById)
      .filter((directory) => !excluded.has(directory.id))
      .sort((a, b) =>
        (a.display_name ?? a.name ?? a.slug ?? a.id).localeCompare(
          b.display_name ?? b.name ?? b.slug ?? b.id,
        ),
      )
      .map((directory) => ({
        id: directory.id,
        label:
          directory.display_name ??
          directory.name ??
          directory.slug ??
          directory.id,
      }));
  }, [directoriesById, parentDirectoryIds]);

  const handleUpdateParentDirectories = async () => {
    if (!noteId || !note) {
      return;
    }
    if (parentDirectoryIds.includes(selectedParentId)) {
      // Already a parent — nothing to do.
      setMoveDialogOpen(false);
      return;
    }

    // Root means "no parent" — clear the list entirely.
    const isRoot = selectedParentId === ROOT_PARENT_ID;
    const nextDirectoryIds = isRoot
      ? []
      : [...parentDirectoryIds, selectedParentId];

    setIsUpdatingParent(true);
    try {
      const updatedNote = new Note({
        ...note,
        directory_ids: nextDirectoryIds,
      } as NoteData);

      await onNoteUpdated(updatedNote);

      setMessage(
        new SnackbarUpdateImpl(
          isRoot ? "Moved to Root" : "Parent directory added",
          "success",
        ),
      );
      setMoveDialogOpen(false);
    } catch (error) {
      console.error("Failed to update parent directories", error);
      setMessage(
        new SnackbarUpdateImpl("Failed to update parent directories", "error"),
      );
    } finally {
      setIsUpdatingParent(false);
    }
  };

  const handleRemoveParentDirectory = useCallback(
    async (directoryId: string) => {
      if (!noteId || !note) {
        return;
      }

      // The note must always have at least one parent directory.
      if (parentDirectoryIds.length <= 1) {
        setMessage(
          new SnackbarUpdateImpl(
            "Cannot remove the only parent directory",
            "error",
            undefined,
            "A note must have at least one directory",
          ),
        );
        return;
      }

      try {
        const updatedNote = new Note({
          ...note,
          directory_ids: parentDirectoryIds.filter((id) => id !== directoryId),
        } as NoteData);

        await onNoteUpdated(updatedNote);

        setMessage(
          new SnackbarUpdateImpl("Parent directory removed", "success"),
        );
      } catch (error) {
        console.error("Failed to remove parent directory", error);
        setMessage(
          new SnackbarUpdateImpl("Failed to remove parent directory", "error"),
        );
      }
    },
    [noteId, note, onNoteUpdated, parentDirectoryIds, setMessage],
  );

  return (
    <>
      <LeftPanel open={true} setOpen={() => {}}>
        <Stack spacing={2} sx={{ p: 2 }}>
          <NoteActionPanel
            isLoading={!note}
            lastEditedLabel={formatTimestamp(note?.updated_at)}
            parentDirectories={parentDirectoryPaths}
            permissionSections={EMPTY_PERMISSION_SECTIONS}
            onNavigateToDirectory={(directoryId) =>
              navigate(`/d/${directoryId}`)
            }
            onChangeParentClick={() => setMoveDialogOpen(true)}
            canChangeParent={Boolean(note && noteId)}
            onRemoveParent={handleRemoveParentDirectory}
            canRemoveParent={Boolean(note && noteId)}
          />
          <Divider sx={{ opacity: 0.3 }} />
          {note && <AttachmentPanelSection note={note} />}
          <Divider sx={{ opacity: 0.3 }} />
          <VersionInfo noteId={noteId} />
          {/* RecentActivityPanel intentionally omitted: the per-note
              `/api/history?note_id=...` query currently 500s on the
              backend, and the `VersionInfo` timeline already serves
              as the per-note activity listing. */}
        </Stack>
      </LeftPanel>

      <ManageParentsDialog
        open={moveDialogOpen}
        isUpdating={isUpdatingParent}
        selectedParentId={selectedParentId}
        parentDirectoryIds={parentDirectoryIds}
        selectableDirectories={selectableDirectories}
        onChangeSelectedParent={setSelectedParentId}
        onConfirm={() => void handleUpdateParentDirectories()}
        onCancel={() => setMoveDialogOpen(false)}
      />
    </>
  );
};
