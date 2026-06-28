import React, { useMemo } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
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
import { M1, M2 } from "../../statics";
import { MicroInteractionButton } from "../../components/MicroInteractionButton";
import { formatDistanceToNowStrict } from "date-fns";
import type { NoteShareReply } from "../../api/models/sharing";

export interface ShareCardProps {
  share: NoteShareReply;
  /** Where this note is hosted — prepended to the share ID to form the URL. */
  shareUrlBase?: string;
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
 * The copy button is a `MicroInteractionButton` that swaps the copy
 * icon for a success checkmark for ~1s when clicked.
 */
export const ShareCard: React.FC<ShareCardProps> = ({
  share,
  shareUrlBase = typeof window !== "undefined" ? window.location.origin : "",
}) => {
  const shareUrl = useMemo(() => {
    if (!share.id) return "";
    const base = shareUrlBase.replace(/\/$/, "");
    return `${base}/public/n/${share.id}`;
  }, [share.id, shareUrlBase]);

  const permission = formatPermission(
    (share as { permission?: string }).permission,
  );

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        bgcolor: "transparent",
        border: (t) => `1px solid ${t.palette.divider}`,
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

        <Stack
          direction="row"
          spacing={M1}
          sx={{ alignItems: "center", flex: 1, minWidth: 0 }}
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
