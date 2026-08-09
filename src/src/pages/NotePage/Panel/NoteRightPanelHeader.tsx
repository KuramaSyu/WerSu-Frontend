import {
  Grow,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import SaveIcon from "@mui/icons-material/Save";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteIcon from "@mui/icons-material/Delete";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import { PanelSection } from "../../../components/Panels/PanelSection";
import { useActiveNoteStore } from "../../../zustand/editorStore";
import { useViewConfig } from "../../../zustand/useViewConfig";
import { useDeleteNote } from "../../../api/queries/useNoteQueries";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShareDialog } from "../ShareDialog";
import { ConfirmationModal } from "../../Settings/ConfirmationModal";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { useThemeStore } from "../../../zustand/useThemeStore";

/**
 * Top-of-right-panel action row: Save, Share, and a 3-dot overflow
 * menu hosting A4/full-width toggle + Delete. Lifted out of
 * `NoteButtonActionRow` so the editor's title row stays free of
 * controls and the right rail owns them instead.
 *
 * Below the action row sits the collab batch (connection status
 * chip + live-users chip) — moved here from the editor header so
 * the editor canvas stays focused on the note itself.
 *
 * Reads its dependencies from the shared zustand stores
 * (`useActiveNoteStore`, `useViewConfig`) so
 * the parent doesn't need to thread props.
 */
export const NoteRightPanelHeader: React.FC = () => {
  const handleSave = useActiveNoteStore((s) => s.save);
  const noteId = useActiveNoteStore((s) => s.noteId);
  const readOnly = useViewConfig((s) => s.config.readOnly);
  const editMode = useEditorSettings((s) => s.editMode);
  const a4Width = useViewConfig((s) => s.config.a4Width);
  const setViewConfig = useViewConfig((s) => s.setViewConfig);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const navigate = useNavigate();
  const deleteNote = useDeleteNote();
  const { theme } = useThemeStore();

  // Overflow menu wiring — mirrors the anchor + Menu pattern used
  // in ShareDialog.tsx. Close on selection so the menu doesn't
  // linger over the right panel after a click.
  const openMenu = (event: React.MouseEvent<HTMLElement>) =>
    setMenuAnchor(event.currentTarget);
  const closeMenu = () => setMenuAnchor(null);

  const handleToggleA4Width = () => {
    setViewConfig({ a4Width: !a4Width });
    closeMenu();
  };

  // Delete is gated to non-readOnly sessions (logged-in note
  // owners) — public viewers can't mutate the note, so the
  // destructive option is hidden for them.
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
      // The mutation's error surfaces inline in the
      // ConfirmationModal via the `errorMessage` prop below.
      // Re-throw to keep the dialog open with the error visible.
      throw error;
    }
  };

  return (
    <>
      {/* Actions section: Save, Share, and the overflow menu
          (A4/full-width toggle + Delete). Non-collapsible so the
          buttons stay reachable for users who hit the rail to
          mutate the note. */}
      <PanelSection title="Actions">
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: "center",
            transition: theme.transitions.create("all"),
          }}
        >
          {/* Save pops in only when the editor enters edit mode
              (and the session is not read-only). `Grow` mounts +
              animates the icon so the user sees the new affordance
              appear instead of having it blink into existence. */}
          <Grow
            in={!readOnly && editMode}
            timeout={theme.transitions.duration.complex}
            mountOnEnter
            unmountOnExit
          >
            <Tooltip title="Save">
              <IconButton onClick={() => void handleSave()}>
                <SaveIcon />
              </IconButton>
            </Tooltip>
          </Grow>

          <Tooltip title="Share">
            <IconButton onClick={() => setShareDialogOpen(true)}>
              <ShareIcon />
            </IconButton>
          </Tooltip>

          {/* Overflow menu — Delete + A4/full-width toggle */}
          <Tooltip title="More actions">
            <IconButton
              aria-label="more actions"
              aria-haspopup="menu"
              aria-expanded={menuAnchor !== null}
              onClick={openMenu}
              disabled={deleteNote.isPending}
            >
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
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
                {a4Width ? "Use full width" : "Use Paper width"}
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
      </PanelSection>
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
