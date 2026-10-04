import {
  Box,
  Button,
  IconButton,
  Paper,
  Slide,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import { useMemo, useState } from "react";
import { useDirectorySelectionStore } from "../../zustand/useDirectorySelectionStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useBulkSelectionActions } from "./useBulkSelectionActions.hook";
import { MoveCopyTargetDialog } from "./MoveCopyTargetDialog";
import { ConfirmationModal } from "../Settings/ConfirmationModal";

/**
 * Sticky top action bar shown while the user has selected one or more
 * directory / note rows. Surfaces the bulk actions: move, copy,
 * delete, plus select-all / clear.
 */
export const SelectionActionBar: React.FC<{
  /** Every selectable row on the current page, used by Select All. */
  allSelectable: { kind: "directory" | "note"; id: string }[];
}> = ({ allSelectable }) => {
  // Pull the wrapped theme from the store so sx objects can call
  // theme.elevate; the sx-callback form would receive the nearest
  // <ThemeProvider> theme, which may be a stock MUI theme that lacks
  // the elevate extension.
  const { theme } = useThemeStore();
  const active = useDirectorySelectionStore((s) => s.active);
  const selected = useDirectorySelectionStore((s) => s.selected);
  const clear = useDirectorySelectionStore((s) => s.clear);
  const selectAll = useDirectorySelectionStore((s) => s.selectAll);
  const exitSelectMode = useDirectorySelectionStore((s) => s.exitSelectMode);

  const actions = useBulkSelectionActions();

  const [moveOpen, setMoveOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const count = useMemo(() => Object.keys(selected).length, [selected]);
  const total = allSelectable.length;
  const allSelected = count > 0 && count === total;

  return (
    <>
      <Slide direction="down" in={active} mountOnEnter unmountOnExit>
        <Paper
          elevation={6}
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            mx: -1,
            px: 1.5,
            py: 1,
            mb: 1.5,
            borderRadius: 2,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mr: 1 }}>
              {count} selected
            </Typography>
            <Tooltip title="Move to directory">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DriveFileMoveIcon fontSize="small" />}
                  onClick={() => setMoveOpen(true)}
                  disabled={count === 0}
                >
                  Move
                </Button>
              </span>
            </Tooltip>
            <Tooltip
              title={
                actions.hasDirectory
                  ? "Copying directories is not supported"
                  : "Copy to directory"
              }
            >
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon fontSize="small" />}
                  onClick={() => setCopyOpen(true)}
                  disabled={count === 0 || actions.hasDirectory}
                >
                  Copy
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Delete">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon fontSize="small" />}
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={count === 0}
                >
                  Delete
                </Button>
              </span>
            </Tooltip>
            <Box sx={{ flex: 1 }} />
            <Tooltip title={allSelected ? "Clear selection" : "Select all"}>
              <Button
                size="small"
                variant="text"
                startIcon={
                  allSelected ? (
                    <ClearIcon fontSize="small" />
                  ) : (
                    <DoneAllIcon fontSize="small" />
                  )
                }
                onClick={() => {
                  if (allSelected) {
                    clear();
                  } else {
                    selectAll(allSelectable);
                  }
                }}
              >
                {allSelected ? "Select None" : "Select All"}
              </Button>
            </Tooltip>
            <Tooltip title="Exit selection mode">
              <IconButton
                size="small"
                aria-label="Exit selection mode"
                onClick={exitSelectMode}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>
      </Slide>

      <MoveCopyTargetDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={`Move ${count} item${count === 1 ? "" : "s"} to`}
        actionLabel="Move here"
        onConfirm={async (targetId) => {
          await actions.moveTo(targetId);
          setMoveOpen(false);
        }}
      />
      <MoveCopyTargetDialog
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title={`Copy ${count} note${count === 1 ? "" : "s"} to`}
        actionLabel="Copy here"
        onConfirm={async (targetId) => {
          await actions.copyTo(targetId);
          setCopyOpen(false);
        }}
      />
      <ConfirmationModal
        open={deleteConfirmOpen}
        confirming={deleting}
        title={`Delete ${count} item${count === 1 ? "" : "s"}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        maxWidth="xs"
        onCancel={() => {
          if (!deleting) setDeleteConfirmOpen(false);
        }}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await actions.deleteSelected();
            setDeleteConfirmOpen(false);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </>
  );
};

export default SelectionActionBar;
