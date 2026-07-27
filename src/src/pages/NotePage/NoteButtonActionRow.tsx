import {
  Button,
  Collapse,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import type { Editor } from "@tiptap/core";
import ShareIcon from "@mui/icons-material/Share";
import SaveIcon from "@mui/icons-material/Save";
import { Share } from "@mui/icons-material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteIcon from "@mui/icons-material/Delete";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useViewConfig } from "../../zustand/useViewConfig";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShareDialog } from "./ShareDialog";
import { CollabStatusBadge } from "./CollabStatusBadge";
import { ConfirmationModal } from "../Settings/ConfirmationModal";
import { useDeleteNote } from "../../api/queries/useNoteQueries";

export const NoteButtonActionRow: React.FC = () => {
  const handleSave = useActiveNoteStore((s) => s.save);
  const { editMode: write, setWrite } = useEditorSettings();
  const readOnly = useViewConfig((s) => s.config.readOnly);
  const a4Width = useViewConfig((s) => s.config.a4Width);
  const setViewConfig = useViewConfig((s) => s.setViewConfig);
  const { theme } = useThemeStore();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const noteId = useActiveNoteStore((s) => s.noteId);
  const navigate = useNavigate();
  const deleteNote = useDeleteNote();
  const handleChange = (
    event: React.MouseEvent<HTMLElement>,
    newAlignment: string,
  ) => {
    setWrite(newAlignment === "write");
  };

  const control = {
    value: write ? "write" : "read",
    onChange: handleChange,
    exclusive: true,
  };

  // Overflow menu wiring — mirrors the anchor + Menu pattern used in
  // ShareDialog.tsx. Close on selection so the menu doesn't linger
  // over the editor after a click.
  const openMenu = (event: React.MouseEvent<HTMLElement>) =>
    setMenuAnchor(event.currentTarget);
  const closeMenu = () => setMenuAnchor(null);

  const handleToggleA4Width = () => {
    setViewConfig({ a4Width: !a4Width });
    closeMenu();
  };

  // Delete is gated to non-readOnly sessions (logged-in note owners) —
  // public viewers can't mutate the note, so the destructive option
  // is hidden for them.
  const handleMenuDelete = () => {
    closeMenu();
    setConfirmDeleteOpen(true);
  };

  const runDelete = async () => {
    if (!noteId) {
      return;
    }
    try {
      await deleteNote.mutateAsync(noteId);
      setConfirmDeleteOpen(false);
      // Note is gone — leave the page so the editor doesn't keep
      // showing a stale document.
      navigate("/");
    } catch (error) {
      // The mutation's error surfaces inline in the ConfirmationModal
      // via the `errorMessage` prop below. Re-throw to keep the
      // dialog open with the error visible.
      throw error;
    }
  };
  return (
    <>
      <Stack
        direction={"column"}
        spacing={theme.spacing(0.5)}
        sx={{ alignItems: "flex-start" }}
      >
        <Stack direction={"row"} spacing={theme.spacing(1)}>
          {/* View-mode controls — toggle + save are hidden when the page
              pins the editor read-only (read-only public shares). The
              share button stays visible: public viewers can copy the URL
              themselves, and it doesn't mutate the note. */}
          {!readOnly && (
            <>
              <ToggleButtonGroup
                size="small"
                {...control}
                aria-label="edit or view mode"
              >
                <ToggleButton value={"read"} key="left">
                  read
                </ToggleButton>

                <ToggleButton value={"write"} key="center">
                  write
                </ToggleButton>
              </ToggleButtonGroup>

              <IconButton onClick={() => void handleSave()}>
                <SaveIcon />
              </IconButton>
            </>
          )}

          <IconButton onClick={() => setShareDialogOpen(true)}>
            <ShareIcon />
          </IconButton>

          {/* Overflow menu — Delete + A4/full-width toggle*/}
          <IconButton
            aria-label="more actions"
            aria-haspopup="menu"
            aria-expanded={menuAnchor !== null}
            onClick={openMenu}
            disabled={deleteNote.isPending}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={closeMenu}
            slotProps={{ list: { dense: true } }}
          >
            <MenuItem onClick={handleToggleA4Width}>
              <ListItemIcon>
                {a4Width ? (
                  <FitScreenIcon fontSize="small" />
                ) : (
                  <AspectRatioIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText>
                {a4Width ? "Use full width" : "Use A4 width"}
              </ListItemText>
            </MenuItem>
            {!readOnly && (
              <MenuItem onClick={handleMenuDelete}>
                <ListItemIcon sx={{ color: "error.main" }}>
                  <DeleteIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText sx={{ color: "error.main" }}>
                  Delete note
                </ListItemText>
              </MenuItem>
            )}
          </Menu>
        </Stack>

        {/* Collab badge — hidden in read mode; the Collapse animation matches
            the editor's `theme.transitions.duration.complex` so it slides in
            without competing with the editor mount. */}
        <Collapse
          in={write}
          timeout={theme.transitions.duration.complex}
          mountOnEnter
          unmountOnExit
        >
          <CollabStatusBadge />
        </Collapse>
      </Stack>
      <ShareDialog
        noteId={noteId ?? ""}
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
      />
      <ConfirmationModal
        title="Delete this note?"
        message="This permanently removes the note and its attachments. This action cannot be undone."
        confirmLabel="Delete"
        maxWidth="xs"
        open={confirmDeleteOpen}
        confirming={deleteNote.isPending}
        errorMessage={
          deleteNote.error instanceof Error ? deleteNote.error.message : null
        }
        onCancel={() => {
          if (!deleteNote.isPending) {
            setConfirmDeleteOpen(false);
          }
        }}
        onConfirm={() => {
          void runDelete();
        }}
      />
    </>
  );
};
