import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import DraftsIcon from "@mui/icons-material/Drafts";
import NotificationsIcon from "@mui/icons-material/Notifications";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useThemeStore } from "../../zustand/useThemeStore";
import useInfoStore, {
  copyToClipboard,
  SnackbarUpdateImpl,
  type LogEntry,
} from "../../zustand/InfoStore";
import { crumble } from "../../utils/stringCrumbler";
import { M1, M2, M3 } from "../../statics";
import {
  NOTIFICATION_DESCRIPTION_CAP,
  NOTIFICATION_MESSAGE_CAP,
  NOTIFICATIONS_PANEL_MAX_HEIGHT,
} from "./constants";

/**
 * Tinted background per severity. Pre-computed against the active
 * theme palette so MUI's runtime alpha() only runs on theme change,
 * not on every row render.
 */
const notificationBgForSeverity = (
  severity: LogEntry["severity"],
  palette: import("@mui/material/styles").Palette,
): string => {
  switch (severity) {
    case "success":
      return alpha(palette.success.main, 0.12);
    case "warning":
      return alpha(palette.warning.main, 0.18);
    case "error":
      return alpha(palette.error.main, 0.18);
    default:
      return alpha(palette.info.main, 0.12);
  }
};

/**
 * Notification log rendered inside the user drawer.
 *
 * Shows every entry in `useInfoStore().logs`, newest first, with
 * per-row "copy to clipboard" + dismiss buttons and a single "Mark
 * all as read" + "Clear all" pair at the top of the list. Rows are
 * individually expandable so a long description doesn't dominate
 * the drawer height by default.
 */
export const NotificationsPanel: React.FC = () => {
  const { theme } = useThemeStore();
  const logs = useInfoStore((s) => s.logs);
  const removeLog = useInfoStore((s) => s.removeLog);
  const clearLogs = useInfoStore((s) => s.clearLogs);
  const markAsRead = useInfoStore((s) => s.markAsRead);
  const markAllAsRead = useInfoStore((s) => s.markAllAsRead);
  const setMessage = useInfoStore((s) => s.setMessage);

  // Derived: how many entries are still unread. Kept local because
  // it's an O(n) scan and re-using it as a store field would force
  // every log push to recompute it.
  const unreadCount = logs.reduce(
    (n, e) => n + (e.readAt === undefined ? 1 : 0),
    0,
  );

  const handleCopy = async (entry: LogEntry) => {
    // Copying the entry counts as "the user saw it" — flip the
    // read flag so the unread badge updates.
    markAsRead(entry.id);
    const payload = entry.description
      ? `${entry.message}\n\n${entry.description}`
      : entry.message;
    const ok = await copyToClipboard(payload);
    // Reuse the global info snackbar so copy feedback matches every
    // other copy button in the app — no extra toast machinery.
    setMessage(
      new SnackbarUpdateImpl(
        ok ? "Copied to clipboard" : "Copy failed",
        ok ? "success" : "error",
      ),
    );
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Stack
        direction="row"
        spacing={M1}
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          px: M2,
          py: M1,
        }}
      >
        <Stack direction="row" spacing={M1} sx={{ alignItems: "center" }}>
          <NotificationsIcon fontSize="small" />
          <Typography variant="subtitle1">Notifications</Typography>
          {/* Show "unread / total" so the user can tell at a glance
              whether anything still needs their attention. "0 / N"
              collapses to the total so the chip stays narrow. */}
          <Chip
            size="small"
            label={
              unreadCount > 0 ? `${unreadCount} / ${logs.length}` : logs.length
            }
            color={unreadCount > 0 ? "primary" : "default"}
            variant="outlined"
          />
        </Stack>
        <Stack direction="row" spacing={M1}>
          <Tooltip
            title={
              unreadCount === 0 ? "No unread notifications" : "Mark all as read"
            }
          >
            <span>
              <IconButton
                size="small"
                aria-label="mark all notifications as read"
                onClick={() => markAllAsRead()}
                disabled={unreadCount === 0}
              >
                <DraftsIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip
            title={
              logs.length === 0 ? "No notifications to clear" : "Clear all"
            }
          >
            {/* span wrapper so Tooltip can hover a disabled button */}
            <span>
              <IconButton
                size="small"
                aria-label="clear all notifications"
                onClick={() => clearLogs()}
                disabled={logs.length === 0}
              >
                <DeleteSweepIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      <Divider />

      {logs.length === 0 ? (
        <Box sx={{ p: M3, textAlign: "left" }}>
          <Typography variant="body2" color="text.secondary">
            No notifications yet.
          </Typography>
        </Box>
      ) : (
        <Stack
          spacing={M1}
          sx={{
            maxHeight: NOTIFICATIONS_PANEL_MAX_HEIGHT,
            overflowY: "auto",
            px: M2,
            py: M1,
          }}
        >
          {logs.map((entry) => (
            <Accordion
              key={entry.id}
              disableGutters
              elevation={0}
              sx={{
                bgcolor: notificationBgForSeverity(
                  entry.severity,
                  theme.palette,
                ),
                border: (t) => `1px solid ${t.palette.divider}`,
                borderRadius: 2,
                "&:before": { display: "none" },
                // Defensive: even if a child forgets to clip, the
                // Accordion itself can't grow past the drawer's
                // width and visually leak.
                overflow: "hidden",
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon fontSize="small" />}
              >
                <Stack
                  direction="row"
                  spacing={M1}
                  sx={{ alignItems: "center", width: "100%", minWidth: 0 }}
                >
                  <Chip
                    size="small"
                    label={entry.severity}
                    color={entry.severity}
                    variant="outlined"
                    sx={{ flexShrink: 0 }}
                  />
                  {/* `crumble` cuts the message to a single line
                      of text so AccordionSummary height stays
                      bounded. `noWrap` + explicit overflow are a
                      belt-and-braces guard against pathological
                      characters crumble doesn't break. */}
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {crumble(entry.message, NOTIFICATION_MESSAGE_CAP)[0] ??
                      entry.message}
                  </Typography>
                  <Tooltip title="Copy">
                    <IconButton
                      size="small"
                      aria-label="copy notification"
                      onClick={(e) => {
                        // AccordionSummary swallows click events to
                        // toggle expansion; stopPropagation keeps
                        // the copy action separate from the toggle.
                        e.stopPropagation();
                        void handleCopy(entry);
                      }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Dismiss">
                    <IconButton
                      size="small"
                      aria-label="dismiss notification"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Dismissing implicitly means "I saw this" —
                        // flip the read flag before removing.
                        markAsRead(entry.id);
                        removeLog(entry.id);
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </AccordionSummary>
              {entry.description && (
                <AccordionDetails
                  sx={{
                    // Hard cap the expanded body too. The text
                    // itself is crumbled; overflow clipping is a
                    // fallback for anything crumble couldn't
                    // split (huge unbroken URLs).
                    overflow: "hidden",
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflow: "hidden",
                    }}
                  >
                    {crumble(
                      entry.description,
                      NOTIFICATION_DESCRIPTION_CAP,
                    ).join("\n\n")}
                  </Typography>
                </AccordionDetails>
              )}
            </Accordion>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default NotificationsPanel;
