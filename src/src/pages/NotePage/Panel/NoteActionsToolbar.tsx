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
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import DeleteIcon from "@mui/icons-material/Delete";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SpellcheckIcon from "@mui/icons-material/Spellcheck";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveNoteStore } from "../../../zustand/editorStore";
import useInfoStore, {
  SnackbarUpdateImpl,
  copyToClipboard,
} from "../../../zustand/InfoStore";
import { useViewConfig } from "../../../zustand/useViewConfig";
import { useDeleteNote } from "../../../api/queries/useNoteQueries";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { useTopBarStore } from "../../../zustand/useTopBarStore";
import { useHeaderImageModalStore } from "../../../zustand/useHeaderImageModalStore";
import { usePublicRouteReady } from "../../../hooks/usePublicRouteReady";
import { getNoteActionVisibility } from "./noteActionVisibility";
import { NoteWidthToggle } from "./NoteWidthToggle";
import { ShareDialog } from "../ShareDialog";
import { ConfirmationModal } from "../../Settings/ConfirmationModal";
import { PermissionEditor } from "../../../components/Permissions/PermissionEditor";
import { SpellcheckDialog } from "../../../components/Editor/SpellcheckDialog";
import { StateFab, type StateFabState } from "../../../components/StateFab";
import { SAVED_STATUS_DURATION_MS } from "../../../zustand/noteSaveMachine";

/**
 * Save control states. The icon + label pair follows the same
 * micro-interaction as the editor FABs: the label expands when the
 * state changes (and on hover), then collapses back to an icon.
 */
const SAVE_STATES: StateFabState[] = [
  // After "Saved now" times out the note is simply clean again; that
  // quiet state should not pulse "No Changes" in the top bar.
  {
    key: "notSavable",
    icon: <SaveIcon />,
    text: "No Changes",
    startCollapsed: true,
  },
  { key: "idle", icon: <SaveIcon />, text: "Save" },
  {
    key: "saving",
    icon: <CloudSyncIcon />,
    text: "Saving",
  },
  { key: "saved", icon: <CloudDoneIcon />, text: "Saved now" },
  { key: "failed", icon: <ErrorOutlineIcon />, text: "Failed" },
];

const SAVE_LABEL_DURATION_MS = 3_000;
/** Idle only explains itself on hover; meaningful transitions pulse. */
const SAVE_PULSE_KEYS = ["saving", "saved", "failed"];

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
  const saveStatus = useActiveNoteStore((s) => s.saveStatus);
  const headerImageMarkdown = useActiveNoteStore((s) => s.headerImageMarkdown);
  const setHeaderImageModalOpen = useHeaderImageModalStore((s) => s.setOpen);
  const readOnly = useViewConfig((s) => s.config.readOnly);
  const editMode = useEditorSettings((s) => s.editMode);
  // Public viewers (anonymous or signed-in) don't own the note, so
  // sharing it again and deleting it are both off the table. Save
  // stays available for write-granted shares; the 3-dot overflow
  // remains for the local paper-width toggle.
  const { isPublic } = usePublicRouteReady({ timeoutMs: 0 });
  const { showSave, showShare, showDelete } = getNoteActionVisibility({
    isPublic,
    readOnly,
    editMode,
  });
  // Header images follow the same editability as the banner: only an
  // editable, non-read-only session can add/replace the image.
  const canEditHeader = editMode && !readOnly;
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [spellcheckOpen, setSpellcheckOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const navigate = useNavigate();
  const deleteNote = useDeleteNote();
  const { theme } = useThemeStore();
  const setMessage = useInfoStore((s) => s.setMessage);

  // The save control explains its current state next to the icon. The
  // "Saved now" window is longer than the default state-label pulse so
  // the confirmation stays readable for a few seconds after the upload.
  const saveLabelDurationMs =
    saveStatus === "saved" ? SAVED_STATUS_DURATION_MS : SAVE_LABEL_DURATION_MS;
  const saveLabel =
    saveStatus === "saving"
      ? "Saving"
      : saveStatus === "saved"
        ? "Saved now"
        : saveStatus === "failed"
          ? "Failed to save"
          : saveStatus === "notSavable"
            ? "No Changes"
            : "Save";
  const saveIconColor =
    saveStatus === "failed"
      ? theme.palette.error.main
      : saveStatus === "saved"
        ? theme.palette.primary.main
        : saveStatus === "saving"
          ? theme.palette.primary.main
          : saveStatus === "notSavable"
            ? theme.palette.text.disabled
            : theme.palette.text.primary;

  // Overflow menu wiring -- mirrors the anchor + Menu pattern used
  // in `ShareDialog.tsx`. Close on selection so the menu doesn't
  // linger over whichever mount point opened it.
  const openMenu = (event: React.MouseEvent<HTMLElement>) =>
    setMenuAnchor(event.currentTarget);
  const closeMenu = () => setMenuAnchor(null);

  // Delete is gated to non-readOnly sessions (logged-in note
  // owners) -- public viewers can't mutate the note, so the
  // destructive option is hidden for them.
  const handleMenuDelete = () => {
    closeMenu();
    setConfirmDeleteOpen(true);
  };

  // Copy the note's current body as Markdown. Reads through the
  // store's `getContent` so source mode copies the raw buffer and
  // rich mode serialises the live editor -- whichever the user is
  // looking at. Available to every viewer, including read-only and
  // public ones, since it only reads.
  const handleMenuCopyMarkdown = async () => {
    closeMenu();
    const markdown = useActiveNoteStore.getState().getContentWithHeader();
    const copied = await copyToClipboard(markdown);
    setMessage(
      new SnackbarUpdateImpl(
        copied ? "Copied as Markdown" : "Couldn't copy Markdown",
        copied ? "success" : "error",
      ),
    );
  };

  // Opens the same picker as the banner's image button. The modal is
  // mounted by `NoteEditorCore`, which reads the shared open flag.
  const handleMenuHeaderImage = () => {
    closeMenu();
    setHeaderImageModalOpen(true);
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
        {/* Save stays reachable while viewing, too: task checkboxes can
            be ticked without entering edit mode, and the change then
            needs a way to persist. The FAB-style control spells out
            "Saving", "Saved now" (for SAVED_STATUS_DURATION_MS) or "Failed" next to its
            icon, and reveals the same label on hover. */}
        <Grow
          in={showSave}
          timeout={theme.transitions.duration.complex}
          mountOnEnter
          unmountOnExit
        >
          <StateFab
            states={SAVE_STATES}
            activeKey={saveStatus}
            aria-label={saveLabel}
            labelDurationMs={saveLabelDurationMs}
            expandKeys={SAVE_PULSE_KEYS}
            expandOnHover
            // On page load the top bar is busy enough without the save
            // control spelling itself out; it still pulses on state
            // changes and on hover.
            startCollapsed
            buttonSize={40}
            expandedRadius={12}
            iconGap={1}
            disabled={saveStatus === "saving"}
            aria-disabled={
              saveStatus === "saving" || saveStatus === "notSavable"
            }
            onClick={() => void handleSave()}
            sx={{
              backgroundColor: "transparent",
              color: saveIconColor,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: theme.palette.action.hover,
                boxShadow: "none",
              },
              "&.Mui-disabled": {
                backgroundColor: "transparent",
                color: saveIconColor,
                opacity: 1,
              },
            }}
          />
        </Grow>

        {showShare && (
          <Tooltip title="Share">
            <IconButton onClick={() => setShareDialogOpen(true)}>
              <ShareIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Editor width preset: a single button that cycles through
            normal -> wide -> full, with the current preset in the
            tooltip. Sits left of the overflow so the preset is a
            one-tap affordance instead of a menu item. */}
        <NoteWidthToggle />

        {/* Overflow menu. It always has the read-only "Copy as
            Markdown" item, so the button is always rendered; the
            owner-only Permissions / Delete items are appended when
            the viewer is allowed to mutate the note. */}
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
          {canEditHeader && (
            <MenuItem onClick={handleMenuHeaderImage}>
              <ListItemIcon>
                <AddPhotoAlternateIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                {headerImageMarkdown ? "Edit image" : "Add image"}
              </ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={() => void handleMenuCopyMarkdown()}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Copy as Markdown</ListItemText>
          </MenuItem>
          {/* Spell check is a per-note, per-user setting, so it is
              offered to signed-in viewers only. */}
          {!isPublic && noteId && (
            <MenuItem
              onClick={() => {
                closeMenu();
                setSpellcheckOpen(true);
              }}
            >
              <ListItemIcon>
                <SpellcheckIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Spellcheck</ListItemText>
            </MenuItem>
          )}
          {showDelete && (
            <MenuItem
              onClick={() => {
                closeMenu();
                setPermissionsOpen(true);
              }}
            >
              <ListItemIcon>
                <AdminPanelSettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Permissions</ListItemText>
            </MenuItem>
          )}
          {showDelete && (
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
      <SpellcheckDialog
        open={spellcheckOpen}
        noteId={noteId ?? undefined}
        onClose={() => setSpellcheckOpen(false)}
      />
      <PermissionEditor
        open={permissionsOpen}
        onClose={() => setPermissionsOpen(false)}
        objectType="note"
        objectId={noteId ?? ""}
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
