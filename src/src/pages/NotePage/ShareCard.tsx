import React, { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EventIcon from "@mui/icons-material/Event";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import HelpIcon from "@mui/icons-material/Help";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { M1, M2 } from "../../statics";
import { MicroInteractionButton } from "../../components/MicroInteractionButton";
import { formatDistanceToNowStrict } from "date-fns";
import type { NoteShareReply } from "../../api/models/sharing";

export interface ShareCardProps {
  share: NoteShareReply;
  /** Where this note is hosted — prepended to the share ID to form the URL. */
  shareUrlBase?: string;

  /**
   * Controlled expansion. When undefined the card manages its own
   * accordion state — handy for the read-only case. When provided, the
   * parent decides which card is open (so the dialog can enforce the
   * "only one card extended" rule).
   */
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;

  /** True when the dialog is currently editing this share. */
  isEditing?: boolean;

  /** Fired when the user picks "Delete" from the card's overflow menu. */
  onRequestDelete?: (shareId: string) => void;
}

const KNOWN_PERMISSIONS = new Set([
  "SHARE_PERMISSION_READ",
  "SHARE_PERMISSION_WRITE",
]);

const formatPermission = (
  raw?: string,
): {
  label: string;
  icon: React.ReactNode;
  color: "warning" | "info" | "default";
  variant: "filled" | "outlined";
  tooltip: string;
} => {
  if (!raw) {
    return {
      label: "Unknown",
      icon: <HelpIcon />,
      color: "default",
      variant: "outlined",
      tooltip: "Permission not set",
    };
  }
  if (raw === "SHARE_PERMISSION_WRITE") {
    return {
      label: "Write",
      icon: <EditIcon />,
      color: "warning",
      variant: "filled",
      tooltip: "Recipients can view and modify the note",
    };
  }
  if (raw === "SHARE_PERMISSION_READ") {
    return {
      label: "Read",
      icon: <VisibilityIcon />,
      color: "info",
      variant: "filled",
      tooltip: "Recipients can view the note but cannot modify it",
    };
  }
  if (KNOWN_PERMISSIONS.has(raw)) {
    const isWrite = raw.endsWith("WRITE");
    return {
      label: raw.replace("SHARE_PERMISSION_", ""),
      icon: isWrite ? <EditIcon /> : <VisibilityIcon />,
      color: isWrite ? "warning" : "info",
      variant: "filled",
      tooltip: isWrite
        ? "Recipients can view and modify the note"
        : "Recipients can view the note but cannot modify it",
    };
  }
  return {
    label: raw,
    icon: <HelpIcon />,
    color: "default",
    variant: "outlined",
    tooltip: `Unknown permission: ${raw}`,
  };
};

const formatExpiry = (iso?: string): string => {
  if (!iso) return "never expires";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "never expires";

  // Past dates are reported as "expired" so a stale share stays obvious.
  if (ts <= Date.now()) return "expired";

  return `in ${formatDistanceToNowStrict(ts, { addSuffix: false })}`;
};

/**
 * Human-friendly absolute expiry string for tooltips, e.g.
 *   "Expires Jun 21, 2026, 12:00 PM" / "Expired" / "Never expires".
 */
const formatExpiryTooltip = (iso?: string): string => {
  if (!iso) return "Never expires";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "Never expires";
  if (ts <= Date.now()) return "Expired";
  // `Date.parse` returns a raw epoch number — wrap it in `Date` so
  // `toLocaleString` formats it as a timestamp, not as a localized
  // integer ("1.782.741.795.280").
  return `Accessible until ${new Date(ts).toLocaleString()}`;
};

/**
 * A small, expandable card representing a single share of a note.
 *
 * - `expanded` / `onExpandedChange` make the accordion fully controlled.
 * - `isEditing` shows an "Editing" indicator so the user always knows
 *   which share the dialog form is bound to.
 * - Delete lives behind a 3-dot `Menu` (per the dialog redesign).
 */
export const ShareCard: React.FC<ShareCardProps> = ({
  share,
  shareUrlBase = typeof window !== "undefined" ? window.location.origin : "",
  expanded,
  onExpandedChange,
  isEditing = false,
  onRequestDelete,
}) => {
  const shareUrl = useMemo(() => {
    if (!share.id) return "";
    const base = shareUrlBase.replace(/\/$/, "");
    return `${base}/public/n/${share.id}`;
  }, [share.id, shareUrlBase]);

  const permission = formatPermission(share.permission);

  // 3-dot menu state
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const openMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation(); // don't toggle the accordion
    setMenuAnchor(event.currentTarget);
  };
  const closeMenu = () => setMenuAnchor(null);

  const handleDeleteFromMenu = () => {
    closeMenu();
    if (share.id && onRequestDelete) onRequestDelete(share.id);
  };

  // Controlled vs. uncontrolled accordion handling.
  const isControlled = expanded !== undefined;
  const accordionExpanded = isControlled ? !!expanded : undefined;

  const handleAccordionChange = (
    _event: React.SyntheticEvent,
    next: boolean,
  ) => {
    if (isControlled) onExpandedChange?.(next);
  };

  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={accordionExpanded}
      onChange={handleAccordionChange}
      sx={{
        bgcolor: "transparent",
        // Highlight the card that's currently being edited.
        border: (t) =>
          isEditing
            ? `1px solid ${t.palette.primary.main}`
            : `1px solid ${t.palette.divider}`,
        borderRadius: 2,
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon fontSize="small" />}
        sx={{
          minHeight: 48,
          px: M2,
          "& .MuiAccordionSummary-content": {
            alignItems: "center",
            gap: M2,
            my: 1,
          },
        }}
      >
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "primary.main",
          }}
        >
          <ShareIcon fontSize="small" />
        </Box>

        <Stack direction="column" spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: permission + expiry */}
          <Stack
            direction="row"
            spacing={M1}
            sx={{ alignItems: "center", minWidth: 0 }}
          >
            <Tooltip title={permission.tooltip}>
              {/* `span` wrapper is required so the tooltip can hover an
                  inline element without forcing the chip into a block layout. */}
              <span>
                <Chip
                  size="small"
                  icon={permission.icon as React.ReactElement}
                  label={permission.label}
                  color={permission.color}
                  variant={permission.variant}
                />
              </span>
            </Tooltip>
            <Tooltip title={formatExpiryTooltip(share.online_until)}>
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  alignItems: "center",
                  color: "text.secondary",
                  minWidth: 0,
                }}
              >
                <EventIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption" noWrap>
                  {formatExpiry(share.online_until)}
                </Typography>
              </Stack>
            </Tooltip>
          </Stack>

          {/* Row 2: "Editing" indicator — only when this share is the
              one the dialog form is bound to. */}
          {isEditing && (
            <Chip
              size="small"
              label="Editing"
              color="primary"
              variant="outlined"
              sx={{ alignSelf: "flex-start" }}
            />
          )}
        </Stack>

        {/* Overflow menu — Delete lives here. Stays right-aligned
            outside the meta-column so it doesn't compete with the chips. */}
        <Tooltip title="More actions">
          <span>
            <IconButton
              size="small"
              aria-label="share actions"
              aria-haspopup="menu"
              aria-expanded={menuAnchor !== null}
              onClick={openMenu}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={closeMenu}
          slotProps={{ list: { dense: true } }}
        >
          <MenuItem onClick={handleDeleteFromMenu} disabled={!share.id}>
            <ListItemIcon sx={{ color: "error.main" }}>
              <DeleteOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText sx={{ color: "error.main" }}>Delete</ListItemText>
          </MenuItem>
        </Menu>
      </AccordionSummary>

      <AccordionDetails sx={{ px: M2, pb: M2, pt: 0 }}>
        <Stack spacing={M1}>
          <Stack
            direction="row"
            spacing={M1}
            sx={{
              alignItems: "center",
              p: 1,
              borderRadius: 1,
              bgcolor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.04)",
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={shareUrl}
            >
              {shareUrl}
            </Typography>
            <MicroInteractionButton
              size="small"
              aria-label="copy share url"
              disabled={!shareUrl}
              icon={<ContentCopyIcon fontSize="small" />}
              microInteraction={
                <CheckCircleIcon fontSize="small" color="success" />
              }
              microDurationMs={Math.PI * 1000}
              onTrigger={() => {
                if (shareUrl && navigator.clipboard) {
                  return navigator.clipboard.writeText(shareUrl);
                }
              }}
            />
          </Stack>

          {share.description && (
            <Typography variant="caption" color="text.secondary">
              {share.description}
            </Typography>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

export default ShareCard;
