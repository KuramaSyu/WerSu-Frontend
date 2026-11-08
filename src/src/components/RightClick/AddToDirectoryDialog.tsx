import { useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { ModalShell } from "../ModalShell";
import { FolderCardView } from "../../pages/Home/FolderCardView";
import { useAllDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useNote, useUpdateNote } from "../../api/queries/useNoteQueries";
import { disambiguateLabels } from "../../utils/disambiguateLabels";
import { useThemeStore } from "../../zustand/useThemeStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import type { DirectoryReply } from "../../api/models/directory";

export interface AddToDirectoryDialogProps {
  open: boolean;
  onClose: () => void;
  noteId: string;
  /** Optional title used in the modal header while the note loads. */
  noteTitle?: string;
  /** Called after a move/add succeeds. */
  onDone?: () => void;
}

const labelOf = (directory: DirectoryReply): string =>
  directory.display_name ??
  directory.name ??
  directory.slug ??
  directory.id;

const parentIdsOf = (directory: DirectoryReply): string[] =>
  directory.parent_dir_ids ?? [];

const isTopLevel = (directory: DirectoryReply): boolean => {
  const parents = parentIdsOf(directory);
  return parents.length === 0 || parents.every((id) => id === "root");
};

/**
 * Picker used by the note "Add to directory" context-menu action.
 *
 * Shows top-level folders as the same cards used on Home. Search spans
 * every folder, including nested chapters. The Open action drills into
 * the selected folder; Move to replaces the note's parents and Add to
 * appends the selected folder without removing existing parents.
 */
export const AddToDirectoryDialog: React.FC<AddToDirectoryDialogProps> = ({
  open,
  onClose,
  noteId,
  noteTitle,
  onDone,
}) => {
  const { theme } = useThemeStore();
  const { setMessage } = useInfoStore();
  const { list, isLoading } = useAllDirectoriesQuery(open);
  const { data: note, isLoading: noteLoading } = useNote(
    open ? noteId : undefined,
  );
  const updateNote = useUpdateNote();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on close so a previous drill-down or selection does not leak
  // into the next open. ModalShell routes X / backdrop / Escape here.
  const handleClose = () => {
    setSelectedId(null);
    setViewId(null);
    setQuery("");
    setError(null);
    onClose();
  };

  const directories = useMemo(() => list ?? [], [list]);

  const childrenByParent = useMemo<Record<string, DirectoryReply[]>>(() => {
    const map: Record<string, DirectoryReply[]> = {};
    for (const directory of directories) {
      for (const parentId of parentIdsOf(directory)) {
        if (parentId === "root") continue;
        (map[parentId] ??= []).push(directory);
      }
    }
    return map;
  }, [directories]);

  const topLevel = useMemo(
    () => directories.filter(isTopLevel),
    [directories],
  );

  const labels = useMemo(
    () =>
      disambiguateLabels(
        directories,
        labelOf,
        (directory) => directory.shelf_ids?.[0] ?? directory.id,
        (directory) => directory.id,
      ),
    [directories],
  );

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return directories.filter((directory) =>
      (labels.get(directory) ?? labelOf(directory))
        .toLowerCase()
        .includes(needle),
    );
  }, [directories, labels, query]);

  const visibleDirectories = query.trim()
    ? searchResults
    : viewId
      ? (childrenByParent[viewId] ?? [])
      : topLevel;

  const selected = selectedId
    ? directories.find((directory) => directory.id === selectedId)
    : undefined;
  const viewed = viewId
    ? directories.find((directory) => directory.id === viewId)
    : undefined;
  const viewedLabel = viewed ? (labels.get(viewed) ?? labelOf(viewed)) : "";

  // Resolve the first parent chain so the header can show where the
  // selected folder actually lives instead of only its display name.
  const selectedPath = useMemo(() => {
    if (!selected) return "";
    const byId = new Map(
      directories.map((directory) => [directory.id, directory]),
    );
    const parts: string[] = [];
    const seen = new Set<string>();
    let current: DirectoryReply | undefined = selected;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      parts.unshift(labels.get(current) ?? labelOf(current));
      const parentId: string | undefined = parentIdsOf(current).find(
        (id) => id !== "root",
      );
      current = parentId ? byId.get(parentId) : undefined;
    }
    return parts.join(" / ");
  }, [directories, labels, selected]);

  const openSelected = () => {
    if (!selectedId) return;
    setViewId(selectedId);
    setQuery("");
  };

  const openDirectory = (directoryId: string) => {
    setSelectedId(directoryId);
    setViewId(directoryId);
    setQuery("");
  };

  const runAction = async (mode: "move" | "add") => {
    if (!selectedId || !note) return;
    const currentParents = note.directory_ids ?? [];
    const nextParents =
      mode === "add"
        ? Array.from(new Set([...currentParents, selectedId]))
        : [selectedId];

    setBusy(true);
    setError(null);
    try {
      await updateNote.mutateAsync({
        noteId,
        directory_ids: nextParents,
      });
      setMessage(
        new SnackbarUpdateImpl(
          mode === "add"
            ? "Note added to directory"
            : "Note moved to directory",
          "success",
        ),
      );
      handleClose();
      onDone?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update the note.",
      );
    } finally {
      setBusy(false);
    }
  };

  const title = noteTitle ?? note?.title ?? "this note";

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      disableContextMenu
      icon={<CreateNewFolderIcon fontSize="small" />}
      title={`Add "${title}" to a directory`}
      subtitle="Pick a folder, then add or move the note there."
      maxWidth="md"
      actions={
        <>
          <Button variant="outlined" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderOpenIcon fontSize="small" />}
            onClick={openSelected}
            disabled={!selectedId || busy}
          >
            Open
          </Button>
          <Button
            variant="contained"
            startIcon={<DriveFileMoveIcon fontSize="small" />}
            onClick={() => void runAction("move")}
            disabled={!selectedId || !note || busy || noteLoading}
          >
            Move to
          </Button>
          <Button
            variant="contained"
            startIcon={
              busy ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CreateNewFolderIcon fontSize="small" />
              )
            }
            onClick={() => void runAction("add")}
            disabled={!selectedId || !note || busy || noteLoading}
          >
            Add to
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          size="small"
          fullWidth
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search all folders, including nested chapters"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            minHeight: 32,
            flexWrap: "wrap",
          }}
        >
          {viewId && (
            <Tooltip title="Back to top level">
              <IconButton
                size="small"
                aria-label="Back to top level"
                onClick={() => {
                  setViewId(null);
                  setQuery("");
                }}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Typography variant="body2" color="textSecondary">
            {query.trim()
              ? `Search results for "${query.trim()}"`
              : viewId
                ? `Inside ${viewedLabel || "selected folder"}`
                : "Top-level folders"}
          </Typography>
          {selected && (
            <Typography
              variant="body2"
              sx={{ ml: "auto", color: theme.palette.primary.main }}
            >
              {selectedPath}
            </Typography>
          )}
        </Box>

        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}

        {isLoading ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 1,
            }}
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <FolderCardView
                key={`skeleton-${index}`}
                displayName=""
                loading
                size="small"
              />
            ))}
          </Box>
        ) : visibleDirectories.length === 0 ? (
          <Typography variant="body2" color="textSecondary" sx={{ py: 3 }}>
            {query.trim()
              ? "No folders match this search."
              : "No folders in this directory."}
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 1,
            }}
          >
            {visibleDirectories.map((directory) => {
              const isSelected = directory.id === selectedId;
              return (
                <Box
                  key={directory.id}
                  onClick={() => setSelectedId(directory.id)}
                  onDoubleClick={() => openDirectory(directory.id)}
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    borderRadius: 2,
                    p: 0.5,
                    outline: isSelected
                      ? `2px solid ${theme.palette.primary.main}`
                      : "2px solid transparent",
                    outlineOffset: 1,
                    cursor: "pointer",
                  }}
                >
                  <FolderCardView
                    displayName={labels.get(directory) ?? labelOf(directory)}
                    imageUrl={directory.image_url}
                    size="small"
                    onClick={() => setSelectedId(directory.id)}
                  />
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </ModalShell>
  );
};

export default AddToDirectoryDialog;
