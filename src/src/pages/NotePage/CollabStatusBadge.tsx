import {
  Box,
  Chip,
  CircularProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import SyncIcon from "@mui/icons-material/Sync";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import LockIcon from "@mui/icons-material/Lock";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import {
  getCollabEntry,
  useNoteCollaboration,
} from "../../hooks/useNoteCollaboration";
import {
  useCollabDiagnostic,
  useCollabStatus,
  type CollabStatus,
  type CollabDiagnostic,
} from "../../zustand/useCollabStatusStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { queryClient } from "../../api/queryClient";

interface StatusMeta {
  label: string;
  color: "default" | "warning" | "success" | "error";
  icon: React.ReactElement;
  spinner?: boolean;
}

function meta(status: CollabStatus): StatusMeta {
  switch (status) {
    case "connected":
      return {
        label: "Live",
        color: "success",
        icon: <WifiIcon fontSize="small" />,
      };
    case "connecting":
      return {
        label: "Connecting",
        color: "warning",
        icon: <SyncIcon fontSize="small" />,
        spinner: true,
      };
    case "awaitingToken":
      return {
        label: "Awaiting login",
        color: "warning",
        icon: <HourglassEmptyIcon fontSize="small" />,
        spinner: true,
      };
    case "tokenFetchError":
      return {
        label: "Login failed",
        color: "error",
        icon: <ErrorOutlineOutlinedIcon fontSize="small" />,
      };
    case "authFailed":
      return {
        label: "Auth failed",
        color: "error",
        icon: <LockIcon fontSize="small" />,
      };
    case "disconnected":
      return {
        label: "Offline",
        color: "error",
        icon: <WifiOffIcon fontSize="small" />,
      };
    case "idle":
    default:
      return {
        label: "Idle",
        color: "default",
        icon: <HourglassEmptyIcon fontSize="small" />,
      };
  }
}

function sinceLabel(ts: number | undefined): string | undefined {
  if (!ts) return undefined;
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function tooltipBody(
  status: CollabStatus,
  d: CollabDiagnostic,
): React.ReactNode {
  const since = sinceLabel(d.since);
  switch (status) {
    case "connected":
      return (
        <TooltipLine
          primary="Connected to the collaboration server."
          since={since}
          sincePrefix="Live for"
        />
      );
    case "connecting":
      return (
        <TooltipLine
          primary="Opening WebSocket to the collaboration server…"
          since={since}
          sincePrefix="Started"
        />
      );
    case "awaitingToken":
      return (
        <TooltipLine
          primary="Waiting for the access token to load before opening the socket."
          secondary="Open devtools → Network to see /api/auth/access-token."
          since={since}
          sincePrefix="Waiting for"
        />
      );
    case "tokenFetchError":
      return (
        <Stack spacing={0.25}>
          <Typography variant="body2">
            Couldn't fetch an access token from the backend.
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontFamily: "monospace", opacity: 0.85 }}
          >
            error: {d.tokenFetchError ?? "unknown"}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            Check Network → /api/auth/access-token. If 401, sign out and back
            in.
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            Click the chip to retry.
          </Typography>
        </Stack>
      );
    case "authFailed":
      return (
        <Stack spacing={0.25}>
          <Typography variant="body2">
            Server rejected the authentication token.
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontFamily: "monospace", opacity: 0.85 }}
          >
            reason: {d.lastAuthReason ?? "unknown"}
          </Typography>
          {(d.authFailures ?? 1) > 1 && (
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              {d.authFailures} failed attempts in this session.
            </Typography>
          )}
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            Click to retry, or sign out and back in.
          </Typography>
        </Stack>
      );
    case "disconnected":
      return (
        <TooltipLine
          primary="WebSocket closed. The provider will retry automatically."
          secondary="Click the chip to retry now."
          since={since}
          sincePrefix="Since"
        />
      );
    case "idle":
    default:
      return (
        <Typography variant="body2">
          Collaboration is off (read mode or no note selected).
        </Typography>
      );
  }
}

function TooltipLine(props: {
  primary: string;
  secondary?: string;
  since?: string;
  sincePrefix: string;
}) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2">{props.primary}</Typography>
      {props.secondary && (
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          {props.secondary}
        </Typography>
      )}
      {props.since && (
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          {props.sincePrefix} {props.since}.
        </Typography>
      )}
    </Stack>
  );
}

/**
 * Tiny chip mirroring the Hocuspocus connection state. Clickable in
 * `disconnected` / `authFailed` (reconnects) and `tokenFetchError`
 * (invalidates the JWT query).
 */
export const CollabStatusBadge: React.FC = () => {
  const noteId = useActiveNoteStore((s) => s.noteId);
  const { editMode } = useEditorSettings();
  const status = useCollabStatus(noteId);
  const diagnostic = useCollabDiagnostic(noteId);
  // Subscribe so the chip can read the current provider for a manual retry.
  const collab = useNoteCollaboration(editMode && noteId ? noteId : undefined);

  const m = meta(status);
  const clickable =
    status === "disconnected" ||
    status === "authFailed" ||
    status === "tokenFetchError";

  const handleRetry = () => {
    if (status === "tokenFetchError") {
      queryClient.invalidateQueries({ queryKey: ["accessToken"] });
      return;
    }
    (collab?.provider ?? getCollabEntry(noteId ?? "")?.provider)?.connect();
  };

  return (
    <Tooltip title={tooltipBody(status, diagnostic)} arrow enterDelay={150}>
      <Box sx={{ display: "inline-flex", alignItems: "center" }}>
        <Chip
          size="small"
          color={m.color}
          variant={status === "connected" ? "filled" : "outlined"}
          label={m.label}
          icon={
            m.spinner ? <CircularProgress size={14} color="inherit" /> : m.icon
          }
          onClick={clickable ? handleRetry : undefined}
          sx={{ cursor: clickable ? "pointer" : "default" }}
        />
      </Box>
    </Tooltip>
  );
};
