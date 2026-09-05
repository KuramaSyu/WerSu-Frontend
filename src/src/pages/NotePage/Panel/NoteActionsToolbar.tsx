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
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveNoteStore } from "../../../zustand/editorStore";
import { useViewConfig } from "../../../zustand/useViewConfig";
import { useDeleteNote } from "../../../api/queries/useNoteQueries";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { useTopBarStore } from "../../../zustand/useTopBarStore";
import { ShareDialog } from "../ShareDialog";
import { ConfirmationModal } from "../../Settings/ConfirmationModal";

/**
 * Stable id used to register this toolbar in :class:`useTopBarStore`.
 * Order places it leftward of the notifications bell.
 */
export const NOTE_ACTIONS_TOOLBAR_SLOT_ID = "noteActions";
const NOTE_ACTIONS_TOOLBAR_ORDER = 100;

/**
 * Save / Share / overflow toolbar for a single note.
 *
 * The toolbar lives in the desktop top bar at all times (independent
 * of whether the right rail is open or closed). This component is a
 * mount-only registration helper: it publishes
 * :class:`NoteActionsToolbarInner` into :class:`useTopBarStore` on
 * mount and tears the registration down on unmount. Mount it once at
 * the page level (`NotePage`); the top bar reads the registered
 * reference from there. No DOM output.
 *
 * Modal state (Share / Delete) lives with the toolbar that opened it,
 * so closing the rail doesn't strand an open dialog on the wrong side.
 * Both instances read the same :class:`zustand` stores, so external
 * state (Save enabled, A4 toggle, etc.) stays in lockstep.
 */
export const NoteActionsToolbar: React.FC = () => {
  // Mount-only on purpose: the slot reference is the toolbar body
  // itself, registered for the lifetime of the page. The cleanup
  // runs when the page unmounts (e.g. leaving the note route) and
  // tears the registration down with it.
  const setSlot = useTopBarStore((s) => s.setSlot);
  const removeSlot = useTopBarStore((s) => s.removeSlot);
  useEffect(() => {
    setSlot(
      NOTE_ACTIONS_TOOLBAR_SLOT_ID,
      NoteActionsToolbarInner,
      NOTE_ACTIONS_TOOLBAR_ORDER,
    );
    return () => {
      removeSlot(NOTE_ACTIONS_TOOLBAR_SLOT_ID);
    };
  }, [setSlot, removeSlot]);

  return null;
};

/**
 * Bare visual: button row + Share / Delete dialogs. Mounted inside
 * the rail by :class:`NoteActionsToolbar` and inside the top bar by
 * the slot consumer in :class:`DesktopTopBar`.
 *
 * No registration of its own -- the rail copy's effect handles
 * that. Stays presentational so each mounting point stays
 * independent and the consumer doesn't have to thread props.
 */
export const NoteActionsToolbarInner: React.FC = () => {
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

  // Overflow menu wiring -- mirrors the anchor + Menu pattern used
  // in `ShareDialog.tsx`. Close on selection so the menu doesn't
  // linger over whichever mount point opened it.
  const openMenu = (event: React.MouseEvent<HTMLElement>) =>
    setMenuAnchor(event.currentTarget);
  const closeMenu = () => setMenuAnchor(null);

  const handleToggleA4Width = () => {
    setViewConfig({ a4Width: !a4Width });
    closeMenu();
  };

  // Delete is gated to non-readOnly sessions (logged-in note
  // owners) -- public viewers can't mutate the note, so the
  // destructive option is hidden for them.
  const handleMenuDelete = () => {
    closeMenu();
    setConfirmDeleteOpen(true);
  };

  const runDelete = async () => {
    if (!noteId) {
      return;
    }
    // eslint-disable-next-line no-useless-catch
    try {
      await deleteNote.mutateAsync(noteId);
      setConfirmDeleteOpen(false);
      // Note is gone -- leave the page so the editor doesn't keep
      // showing a stale document.
      navigate("/");
    } catch (error) {
      // The mutation's error surfaces inline in the
      // `ConfirmationModal` via the `errorMessage` prop below.
      // Re-throw to keep the dialog open with the error visible.
      throw error;
    }
  };

  return (
    <>
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

        {/* Overflow menu -- Delete + A4/full-width toggle */}
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
