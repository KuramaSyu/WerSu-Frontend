import { useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import HomeIcon from "@mui/icons-material/Home";
import { ModalShell } from "../../components/ModalShell";
import { useAllDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useDirectorySelectionStore } from "../../zustand/useDirectorySelectionStore";
import type { DirectoryReply } from "../../api/models/directory";
import { disambiguateLabels } from "../../utils/disambiguateLabels";

/**
 * Modal that asks the user to pick a destination directory for a
 * move/copy bulk action. Lists the user's top-level directories with
 * an inline "Top level" entry; selecting any directory expands its
 * children so the user can drill in. Cancel / X leaves the selection
 * untouched.
 */
export const MoveCopyTargetDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  actionLabel: string;
  /** Receives the picked directory id, or null for top level. */
  onConfirm: (targetDirectoryId: string | null) => Promise<void> | void;
}> = ({ open, onClose, title, actionLabel, onConfirm }) => {
  const { list, isLoading } = useAllDirectoriesQuery();
  const selected = useDirectorySelectionStore((s) => s.selected);

  // Ids of every selected directory. The dialog forbids moving
  // a directory into one of its own descendants (or itself), so the
  // picker greys those out.
  const selectedDirectoryIds = useMemo(
    () =>
      Object.values(selected)
        .filter((entry) => entry.kind === "directory")
        .map((entry) => entry.id),
    [selected],
  );

  const [pickedId, setPickedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  // Re-derive the children map from the cached reply list so the
  // tree stays in sync with any background updates. The wire
  // payload can omit `parent_dir_ids` entirely (some endpoints
  // strip it the same way they strip `child_note_ids`); treat the
  // missing case as top-level so the dialog never iterates over
  // `undefined`.
  const childrenByParent = useMemo<Record<string, DirectoryReply[]>>(() => {
    const map: Record<string, DirectoryReply[]> = {};
    for (const dir of list ?? []) {
      const parents = dir.parent_dir_ids ?? [];
      if (parents.length === 0) continue;
      for (const parentId of parents) {
        if (!map[parentId]) map[parentId] = [];
        map[parentId].push(dir);
      }
    }
    return map;
  }, [list]);

  const isForbidden = (dir: DirectoryReply): boolean =>
    selectedDirectoryIds.includes(dir.id);

  // Top-level directories declare their parent as "root" in the
  // wire payload, but some endpoints may omit `parent_dir_ids`
  // entirely. We accept either so the dialog works on both reply
  // shapes.
  const topLevel =
    childrenByParent["root"] ??
    (list ?? []).filter((d) => (d.parent_dir_ids ?? []).length === 0);
  const labels = useMemo(
    () => disambiguateLabels(
      list ?? [],
      (d) => d.display_name ?? d.name ?? d.slug ?? d.id,
      (d) => d.shelf_ids?.[0] ?? d.id,
      (d) => d.id,
    ),
    [list],
  );

  const renderRow = (
    dir: DirectoryReply,
    depth: number,
    ancestors: Set<string>,
  ): React.ReactNode => {
    const forbidden = isForbidden(dir);
    const kids = (childrenByParent[dir.id] ?? []).filter(
      (child) => !ancestors.has(child.id),
    );
    const isOpen = expanded[dir.id] ?? false;
    return (
      <Box key={dir.id}>
        <ListItemButton
          disabled={forbidden}
          selected={pickedId === dir.id}
          onClick={() => setPickedId(dir.id)}
          sx={{ pl: 1 + depth * 2 }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={labels.get(dir) ?? dir.display_name ?? dir.id}
            secondary={forbidden ? "Cannot move a directory into itself" : null}
          />
          {kids.length > 0 && (
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => ({ ...prev, [dir.id]: !isOpen }));
              }}
            >
              {isOpen ? "Hide" : `Show (${kids.length})`}
            </Button>
          )}
        </ListItemButton>
        {isOpen &&
          kids.map((child) =>
            renderRow(child, depth + 1, new Set([...ancestors, dir.id])),
          )}
      </Box>
    );
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(pickedId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={<FolderIcon fontSize="small" />}
      title={title}
      subtitle="Pick a destination. Use Top level to clear the parent."
      maxWidth="sm"
      actions={
        <>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void confirm()}
            disabled={busy}
            startIcon={
              busy ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {actionLabel}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            py: 4,
          }}
        >
          <CircularProgress size={24} />
        </Box>
      ) : (
        <List dense disablePadding>
          <ListItemButton
            selected={pickedId === null}
            onClick={() => setPickedId(null)}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <HomeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Top level" secondary="(no parent)" />
          </ListItemButton>
          {topLevel.length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ p: 2 }}>
              No directories yet.
            </Typography>
          ) : (
            topLevel.map((dir) => renderRow(dir, 0, new Set()))
          )}
        </List>
      )}
    </ModalShell>
  );
};
