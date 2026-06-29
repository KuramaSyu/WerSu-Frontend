import React from "react";
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

// Mirrors MUI's small Chip height so both badges stay flush.
const CHIP_HEIGHT = 24;
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import SyncIcon from "@mui/icons-material/Sync";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import LockIcon from "@mui/icons-material/Lock";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import PersonIcon from "@mui/icons-material/Person";
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
import { useLiveUsers } from "../../zustand/useLiveUsersStore";
import { useUsers } from "../../api/queries/useUser";
import { M1, M2 } from "../../statics";

interface StatusMeta {
  label: string;
  color: "default" | "warning" | "success" | "error" | "secondary" | "primary";
  icon: React.ReactElement;
  spinner?: boolean;
}

function meta(status: CollabStatus): StatusMeta {
  switch (status) {
    case "connected":
      return {
        label: "Live",
        color: "secondary",
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
 * Avatar-or-color fallback used by `LiveUserCard`. When the Discord
 * avatar URL has been resolved we show it; otherwise we paint a
 * dot in the user's awareness color so the row stays visually
 * anchored.
 */
function LiveUserAvatar(props: {
  avatarUrl: string | undefined;
  awarenessColor: string | undefined;
}) {
  if (props.avatarUrl) {
    return <Avatar src={props.avatarUrl} sx={{ width: 28, height: 28 }} />;
  }
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        backgroundColor: props.awarenessColor ?? "currentColor",
        opacity: props.awarenessColor ? 1 : 0.4,
        flexShrink: 0,
      }}
    />
  );
}

/**
 * One row in the live-users tooltip. Each user renders as a small
 * `Paper` "card" so the names and avatars don't blur into each
 * other on long lists, and so the colored awareness dot has a
 * distinct surface to sit on.
 */
const LiveUserCard: React.FC<{
  userId: string;
  username: string | undefined;
  avatarUrl: string | undefined;
  awarenessColor: string | undefined;
}> = ({ userId, username, avatarUrl, awarenessColor }) => {
  const display = username ?? userId;
  return (
    <Paper
      sx={{
        px: M2,
        py: M1,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        minWidth: 180,
      }}
    >
      <LiveUserAvatar avatarUrl={avatarUrl} awarenessColor={awarenessColor} />
      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {display}
        </Typography>
        {!username && (
          <Typography
            variant="caption"
            sx={{ opacity: 0.6, fontFamily: "monospace" }}
          >
            {userId}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

/**
 * Tooltip title rendered for the live-users chip. Stacks a header
 * above a list of `LiveUserCard`s; falls back to a short message
 * when there are no users.
 *
 * The `/api/auth/users` endpoint is currently a stub that only
 * returns the current user, so other users will degrade to the
 * raw userId as their display name.
 */
const LiveUsersTooltipTitle: React.FC<{
  userIds: string[];
  usersById:
    | Record<string, { username: string; getAvatarUrl: () => string }>
    | undefined;
  awarenessColors: Record<string, string>;
}> = ({ userIds, usersById, awarenessColors }) => {
  if (userIds.length === 0) {
    return (
      <Typography variant="body2">
        No other users are viewing this note.
      </Typography>
    );
  }
  return (
    <Stack spacing={1} sx={{ py: M1 }}>
      <Typography variant="caption" sx={{ opacity: 0.75, px: M1 }}>
        Users currently viewing this note
      </Typography>
      {userIds.map((id) => {
        const user = usersById?.[id];
        return (
          <LiveUserCard
            key={id}
            userId={id}
            username={user?.username}
            avatarUrl={user?.getAvatarUrl()}
            awarenessColor={awarenessColors[id]}
          />
        );
      })}
    </Stack>
  );
};

/**
 * Tiny chip mirroring the Hocuspocus connection state. Clickable in
 * `disconnected` / `authFailed` (reconnects) and `tokenFetchError`
 * (invalidates the JWT query).
 *
 * When the socket is `connected` and at least one live user is
 * present (other than the current viewer), a sibling chip renders
 * the live user count with a person icon. Hovering it lists each
 * user with their avatar (when resolved) and username.
 */
export const CollabStatusBadge: React.FC = () => {
  const noteId = useActiveNoteStore((s) => s.noteId);
  const { editMode } = useEditorSettings();
  const status = useCollabStatus(noteId);
  const diagnostic = useCollabDiagnostic(noteId);
  // Subscribe so the chip can read the current provider for a manual retry.
  const collab = useNoteCollaboration(editMode && noteId ? noteId : undefined);

  // Live users from the Hocuspocus awareness store. We render the
  // count chip only when `connected` AND there is at least one live
  // user, per the requirement.
  const liveUsers = useLiveUsers(noteId);
  const liveUserIds = React.useMemo(
    () => Array.from(new Set(liveUsers.map((u) => u.userId))),
    [liveUsers],
  );
  const { data: usersById } = useUsers(liveUserIds);
  const awarenessColors = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of liveUsers) {
      map[u.userId] = u.color;
    }
    return map;
  }, [liveUsers]);

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

  const showLiveUsersChip = status === "connected" && liveUserIds.length > 0;

  return (
    <Stack direction="row" spacing={M1} sx={{ alignItems: "center" }}>
      <Tooltip title={tooltipBody(status, diagnostic)} arrow enterDelay={150}>
        <Box sx={{ display: "inline-flex", alignItems: "center" }}>
          <Chip
            size="small"
            color={m.color}
            variant={status === "connected" ? "filled" : "outlined"}
            label={m.label}
            icon={
              m.spinner ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                m.icon
              )
            }
            onClick={clickable ? handleRetry : undefined}
            sx={{
              cursor: clickable ? "pointer" : "default",
              height: CHIP_HEIGHT,
            }}
          />
        </Box>
      </Tooltip>
      {showLiveUsersChip && (
        <Tooltip
          title={
            <LiveUsersTooltipTitle
              userIds={liveUserIds}
              usersById={
                usersById as
                  | Record<
                      string,
                      { username: string; getAvatarUrl: () => string }
                    >
                  | undefined
              }
              awarenessColors={awarenessColors}
            />
          }
          arrow
          enterDelay={150}
        >
          <Box sx={{ display: "inline-flex", alignItems: "center" }}>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              icon={<PersonIcon fontSize="small" />}
              label={liveUserIds.length}
              aria-label={`${liveUserIds.length} live user${liveUserIds.length === 1 ? "" : "s"} viewing this note`}
              sx={{
                cursor: "default",
                height: CHIP_HEIGHT,
                "& .MuiChip-icon": {
                  width: 18,
                  height: 18,
                  fontSize: "1.125rem",
                  marginLeft: "4px",
                  marginRight: "-6px",
                },
              }}
            />
          </Box>
        </Tooltip>
      )}
    </Stack>
  );
};
