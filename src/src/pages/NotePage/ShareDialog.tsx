import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { useThemeStore } from "../../zustand/useThemeStore";
import { M1, M2, M3, M4 } from "../../statics";
import RotatingStrokeBox from "../../components/RotatingCirle";
import {
  useCreateShare,
  useDeleteShares,
  useShares,
  useUpdateShare,
} from "../../api/queries/sharingQueries";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { ShareFormSection } from "./ShareFormSection";
import {
  blankShareFormValue,
  type Permission,
  type ShareFormValue,
} from "./shareFormModel";
import type { NoteShareReply } from "../../api/models/sharing";
import { ShareCard } from "./ShareCard";

export interface ShareDialogProps {
  noteId: string;
  open: boolean;
  onClose: () => void;
}

const Months_1 = 60 * 60 * 24 * 30;

/**
 * The backend's proto3 default for the permission enum. A share must
 * never be submitted with this value — it means "the user picked
 * nothing", which the backend would accept silently. We refuse to
 * forward it from the dialog.
 */
const SHARE_PERMISSION_UNSPECIFIED = "SHARE_PERMISSION_UNSPECIFIED";

const permissionFromString = (raw?: string): Permission =>
  raw === "SHARE_PERMISSION_WRITE" ? "write" : "read";

/**
 * Strict mapping from the form's `Permission` to the backend enum.
 *
 * Returns `null` when the form's value is neither "read" nor "write"
 * so callers can refuse to submit and surface a snackbar instead of
 * silently sending `SHARE_PERMISSION_UNSPECIFIED` to the backend.
 */
const permissionToString = (
  p: Permission | undefined | null,
): string | null => {
  if (p === "write") return "SHARE_PERMISSION_WRITE";
  if (p === "read") return "SHARE_PERMISSION_READ";
  return null;
};

/**
 * Validate the share form before submission.
 *
 * Returns `null` when the form is ready to send, or a user-facing
 * message describing what to change when it isn't. Used by both the
 * create and update handlers so neither path can submit an invalid
 * share (e.g. one whose permission resolved to UNSPECIFIED, or whose
 * expiry is in the past).
 */
const validateShareForm = (formValue: ShareFormValue): string | null => {
  const permission = permissionToString(formValue.permission);
  if (!permission || permission === SHARE_PERMISSION_UNSPECIFIED) {
    return "Please select an access level (read or write) before sharing.";
  }
  const expiryTs = Date.parse(formValue.onlineUntil);
  if (Number.isNaN(expiryTs)) {
    return "Please pick a valid expiry date and time.";
  }
  if (expiryTs <= Date.now()) {
    return "Expiry must be in the future.";
  }
  return null;
};

/**
 * Snapshot of the fields the dialog form can edit. Used to compute
 * `isDirty` in edit mode.
 */
interface EditBaseline {
  permission: Permission;
  onlineUntil: string;
  description: string;
}

const baselineFromShare = (share: NoteShareReply): EditBaseline => ({
  permission: permissionFromString(share.permission),
  // When the existing share has no `online_until`, default to one
  // month from now so the user sees a sane value rather than a blank
  // datetime input the first time they edit.
  onlineUntil:
    share.online_until ?? new Date(Date.now() + Months_1 * 1000).toISOString(),
  description: share.description ?? "",
});

const valueFromBaseline = (b: EditBaseline): ShareFormValue => ({
  visibility: "link", // not currently persisted
  permission: b.permission,
  onlineUntil: b.onlineUntil,
  description: b.description,
});

const isFormDirty = (value: ShareFormValue, baseline: EditBaseline): boolean =>
  value.permission !== baseline.permission ||
  value.onlineUntil !== baseline.onlineUntil ||
  value.description !== baseline.description;

export const ShareDialog: React.FC<ShareDialogProps> = ({
  noteId,
  open,
  onClose,
}) => {
  const { theme } = useThemeStore();
  const setMessage = useInfoStore((s) => s.setMessage);

  // ─── Form state ─────────────────────────────────────────────────────
  // `null` → create mode; a share id → edit mode bound to that share.
  const [editingShareId, setEditingShareId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState<ShareFormValue>(
    blankShareFormValue(),
  );
  const [baseline, setBaseline] = useState<EditBaseline | null>(null);

  // Existing shares for this note.
  const sharesQuery = useShares(
    { note_id: noteId },
    { enabled: !!noteId && open },
  );
  // Memoize so downstream `useMemo`s keyed on `existingShares` stay stable.
  const existingShares = useMemo<NoteShareReply[]>(
    () => sharesQuery.data ?? [],
    [sharesQuery.data],
  );

  const enterCreateMode = () => {
    setEditingShareId(null);
    setFormValue(blankShareFormValue());
    setBaseline(null);
  };

  const enterEditMode = (share: NoteShareReply) => {
    const base = baselineFromShare(share);
    setEditingShareId(share.id);
    setBaseline(base);
    setFormValue(valueFromBaseline(base));
  };

  // Resolve the share we're editing, derived purely from props + state +
  // the current shares list. If the user-selected id no longer exists
  // in the list (e.g. it was deleted elsewhere), we transparently fall
  // back to create mode — without any setState in an effect.
  const editingShare = useMemo(
    () =>
      editingShareId
        ? (existingShares.find((s) => s.id === editingShareId) ?? null)
        : null,
    [editingShareId, existingShares],
  );
  const effectiveEditingShareId = editingShare ? editingShare.id : null;

  // Reset state when the dialog is reopened. Done in a layout effect so
  // it runs before paint and doesn't cause a visible flash of stale UI.
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      enterCreateMode();
    }
    prevOpenRef.current = open;
  }, [open]);

  // ─── Mutations ──────────────────────────────────────────────────────
  const createShare = useCreateShare({
    onSuccess: (reply) => {
      setMessage(new SnackbarUpdateImpl(`Share created with ID: ${reply.id}`));
      enterCreateMode();
    },
    onError: (error) => {
      setMessage(
        new SnackbarUpdateImpl(
          `Error creating share: ${error.message}`,
          "error",
        ),
      );
    },
  });

  const updateShare = useUpdateShare({
    onSuccess: (reply) => {
      setMessage(new SnackbarUpdateImpl(`Share updated`));
      // Drop back into create mode so the next operation starts fresh.
      enterCreateMode();
      // The reply also closes the edit cycle by virtue of invalidating
      // the shares list.
      void reply;
    },
    onError: (error) => {
      setMessage(
        new SnackbarUpdateImpl(
          `Error updating share: ${error.message}`,
          "error",
        ),
      );
    },
  });

  const deleteShares = useDeleteShares({
    onSuccess: () => {
      setMessage(new SnackbarUpdateImpl(`Share deleted`));
      enterCreateMode();
    },
    onError: (error) => {
      setMessage(
        new SnackbarUpdateImpl(
          `Error deleting share: ${error.message}`,
          "error",
        ),
      );
    },
  });

  // ─── Action handlers ────────────────────────────────────────────────
  // Edit mode is *derived* from `effectiveEditingShareId` so that if the
  // share disappears from the server-side list while we're editing, we
  // automatically drop back to create mode in the same render.
  const isEditMode = effectiveEditingShareId !== null;
  const dirty =
    isEditMode && baseline !== null && isFormDirty(formValue, baseline);

  const handleShare = () => {
    // The caller passes `""` when no note is loaded; refuse to send
    // an empty `note_id` rather than fire a request the backend will reject.
    if (!noteId) {
      setMessage(
        new SnackbarUpdateImpl(
          "Cannot create a share without a saved note.",
          "error",
        ),
      );
      return;
    }

    // Refuse to send UNSPECIFIED / unknown permissions — the backend would
    // accept them silently and the share would be effectively unusable.
    const validationError = validateShareForm(formValue);
    if (validationError) {
      setMessage(new SnackbarUpdateImpl(validationError, "error"));
      return;
    }

    createShare.mutate({
      share: {
        note_id: noteId,
        description: formValue.description.trim() || undefined,
        // The form owns the absolute ISO timestamp; send it as-is.
        online_until: formValue.onlineUntil,
        online_since: new Date().toISOString(),
        permission: permissionToString(formValue.permission)!,
      },
    });
  };

  const handleUpdate = () => {
    if (!editingShare) return;

    // Same gate as `handleShare` — we must not let an UNSPECIFIED
    // permission leak back to the backend on update either.
    const validationError = validateShareForm(formValue);
    if (validationError) {
      setMessage(new SnackbarUpdateImpl(validationError, "error"));
      return;
    }

    updateShare.mutate({
      share: {
        id: editingShare.id,
        note_id: editingShare.note_id,
        description: formValue.description.trim() || undefined,
        online_until: formValue.onlineUntil,
        online_since: editingShare.online_since ?? new Date().toISOString(),
        permission: permissionToString(formValue.permission)!,
      },
    });
  };

  const handleDeleteEditing = () => {
    if (!editingShare) return;
    deleteShares.mutate({ share_ids: [editingShare.id] });
  };

  const handleCardRequestDelete = (shareId: string) => {
    deleteShares.mutate({ share_ids: [shareId] });
  };

  // ─── Edit-mode overflow menu (for the Delete action) ────────────────
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const openMenu = (e: React.MouseEvent<HTMLElement>) =>
    setMenuAnchor(e.currentTarget);
  const closeMenu = () => setMenuAnchor(null);
  const handleMenuDelete = () => {
    closeMenu();
    handleDeleteEditing();
  };

  // Only one card can be "expanded" at a time. Toggling another card
  // collapses the previous one and loads it into the form for editing.
  const handleCardToggle = (shareId: string, next: boolean) => {
    if (!next) {
      // Collapsing the active card also exits edit mode (back to "new share").
      if (editingShareId === shareId) enterCreateMode();
      return;
    }
    const target = existingShares.find((s) => s.id === shareId);
    if (target) enterEditMode(target);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      sx={{ overflow: "hidden", p: 0, m: 0 }}
    >
      <DialogContent sx={{ overflow: "hidden" }}>
        {/* group with share icon and content */}
        <Stack direction={"row"} spacing={M4} sx={{}}>
          <RotatingStrokeBox
            color={theme.palette.primary.main}
            borderRadius={100}
          >
            <ShareIcon sx={{ fontSize: theme.typography.h3.fontSize }} />
          </RotatingStrokeBox>
          <Divider orientation="vertical" flexItem />

          {/* group with sharing options and schedule */}
          <Stack direction="column" spacing={M3} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4">
              {isEditMode ? "Edit share" : "Create share"}
            </Typography>

            <ShareFormSection value={formValue} onChange={setFormValue} />
          </Stack>

          <Divider orientation="vertical" flexItem />

          {/* Third column: existing shares for this note. */}
          <Stack
            className="dialog-existing-shares"
            direction="column"
            spacing={M3}
            sx={{ flex: 1, minWidth: 0 }}
          >
            <Typography variant="h4">Existing shares</Typography>
            {/* empty box so that create share buttongroup aligns with start of shares */}
            <Box sx={{ pb: M2 }}></Box>{" "}
            {sharesQuery.isLoading && (
              <Stack
                direction="row"
                spacing={M1}
                sx={{ alignItems: "center", color: "text.secondary" }}
              >
                <CircularProgress size={16} />
                <Typography variant="body2">Loading shares…</Typography>
              </Stack>
            )}
            {!sharesQuery.isLoading && existingShares.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No shares for this note yet.
              </Typography>
            )}
            {!sharesQuery.isLoading && existingShares.length > 0 && (
              <Stack
                spacing={M2}
                sx={{ maxHeight: 360, overflowY: "auto", pr: 1 }}
              >
                {existingShares.map((share) => (
                  <ShareCard
                    key={share.id}
                    share={share}
                    expanded={effectiveEditingShareId === share.id}
                    onExpandedChange={(next: boolean) =>
                      handleCardToggle(share.id, next)
                    }
                    isEditing={effectiveEditingShareId === share.id}
                    onRequestDelete={handleCardRequestDelete}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ gap: M1, pr: M3 }}>
        {isEditMode ? (
          <>
            <Tooltip title="Discard changes and go back to creating a new share">
              <span>
                <Button
                  onClick={enterCreateMode}
                  color="inherit"
                  variant="text"
                >
                  Cancel
                </Button>
              </span>
            </Tooltip>
            <Tooltip
              title={
                dirty ? "Save changes to this share" : "No changes to save"
              }
            >
              <span>
                <Button
                  onClick={handleUpdate}
                  color="primary"
                  variant="contained"
                  disabled={!dirty || updateShare.isPending}
                >
                  Update
                </Button>
              </span>
            </Tooltip>

            {/* 3-dot menu — Delete lives here in edit mode. */}
            <Tooltip title="More actions">
              <IconButton
                aria-label="share actions"
                aria-haspopup="menu"
                aria-expanded={menuAnchor !== null}
                onClick={openMenu}
                disabled={!editingShare || deleteShares.isPending}
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
              <MenuItem onClick={handleMenuDelete} disabled={!editingShare}>
                <ListItemIcon sx={{ color: "error.main" }}>
                  <DeleteOutlineIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText sx={{ color: "error.main" }}>Delete</ListItemText>
              </MenuItem>
            </Menu>
          </>
        ) : (
          <>
            {/* In create mode "Cancel" simply closes the dialog — there's
                no prior state to discard. */}
            <Tooltip title="Discard the new share and close the dialog">
              <Button onClick={onClose} color="inherit" variant="text">
                Cancel
              </Button>
            </Tooltip>
            <Tooltip
              title={
                noteId
                  ? "Create a new share for this note"
                  : "Save the note before sharing"
              }
            >
              <span>
                <Button
                  onClick={handleShare}
                  color="primary"
                  variant="contained"
                  disabled={createShare.isPending || !noteId}
                >
                  Share
                </Button>
              </span>
            </Tooltip>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ShareDialog;
