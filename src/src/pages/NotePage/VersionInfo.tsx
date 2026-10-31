import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grow,
  IconButton,
  Paper,
  Popper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import { PanelSection } from "../../components/Panels/PanelSection";
import Timeline from "@mui/lab/Timeline";
import TimelineItem, { timelineItemClasses } from "@mui/lab/TimelineItem";
import TimelineSeparator from "@mui/lab/TimelineSeparator";
import TimelineConnector from "@mui/lab/TimelineConnector";
import TimelineContent from "@mui/lab/TimelineContent";
import TimelineDot from "@mui/lab/TimelineDot";
import { useThemeStore } from "../../zustand/useThemeStore";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useUser, useUsers } from "../../api/queries/useUser";
import { useLiveUsers } from "../../zustand/useLiveUsersStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NoteApi } from "../../api/NoteApi";
import { NoteVersionsDrawer } from "../../components/NoteVersionsDrawer";
import { formatDistanceToNow } from "date-fns";
import { queryClient } from "../../api/queryClient";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { blendColors, hexToRgb, rgbToHex } from "../../utils/blendWithContrast";
import { useVersionSelection, useVersionRestore } from "./VersionInfo.hooks";
import { displayInitials } from "../../utils/publicUserName";
import {
  collabStatusStore,
  useCollabStatus,
  type CollabStatus,
} from "../../zustand/useCollabStatusStore";
import { usePublicRouteReady } from "../../hooks/usePublicRouteReady";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { shouldPromptMergeOnReconnect } from "../../hooks/collabReconcile";
import type { Note } from "../../api/models/search";

export interface VersionInfoProps {
  noteId: string | undefined;
  /** Optional control rendered on the section's left border. */
  leftEdgeHandle?: React.ReactNode;
}

/** The two editing modes surfaced by the segmented control. */
type EditingMode = "live" | "offline";

/**
 * Maps a collab connection status onto the color + label shown inside
 * the Live segment. The icon is tinted from the theme palette and the
 * label doubles as the tooltip note when the session isn't connected.
 */
function liveStatusVisual(status: CollabStatus): {
  color: string;
  label: string;
  spinner: boolean;
  connected: boolean;
} {
  switch (status) {
    case "connected":
      return {
        color: "success.main",
        label: "Connected to the collaboration server",
        spinner: false,
        connected: true,
      };
    case "connecting":
      return {
        color: "warning.main",
        label: "Connecting to the collaboration server…",
        spinner: true,
        connected: false,
      };
    case "awaitingToken":
      return {
        color: "info.main",
        label: "Awaiting login before connecting…",
        spinner: true,
        connected: false,
      };
    case "tokenFetchError":
      return {
        color: "error.main",
        label: "Couldn't fetch an access token",
        spinner: false,
        connected: false,
      };
    case "authFailed":
      return {
        color: "error.main",
        label: "Authentication failed",
        spinner: false,
        connected: false,
      };
    case "editingOffline":
      return {
        color: "warning.main",
        label: "Editing offline. Changes save to this browser only",
        spinner: false,
        connected: false,
      };
    case "conflict":
      return {
        color: "error.main",
        label: "Sync conflict. Resolve it to keep syncing",
        spinner: false,
        connected: false,
      };
    case "disconnected":
      return {
        color: "error.main",
        label: "Disconnected from the collaboration server",
        spinner: false,
        connected: false,
      };
    case "idle":
    default:
      return {
        color: "text.disabled",
        label: "Collaboration is off",
        spinner: false,
        connected: false,
      };
  }
}

/** A live editor resolved for display beside the draft entry. */
interface LiveIdentity {
  id: string;
  /** Awareness colour, used as the public-user avatar fill. */
  color: string;
  name: string;
  /** Logged-in users only. */
  avatarUrl?: string;
  /** Public (not logged in) users only. */
  initials?: string;
}

export const VersionInfo: React.FC<VersionInfoProps> = ({
  noteId,
  leftEdgeHandle,
}) => {
  const { theme } = useThemeStore();
  const { setWrite, editMode } = useEditorSettings();
  const { isPublic } = usePublicRouteReady({ timeoutMs: 0 });

  const { data: user } = useUser();

  const liveUsers = useLiveUsers(noteId);
  const userIds = useMemo(
    () => [...new Set(liveUsers.map((u) => u.userId))],
    [liveUsers],
  );
  const { data: usersById } = useUsers(userIds);
  // Resolve each awareness user for display. Logged-in users carry an
  // avatar; public users fall back to initials from their id (their
  // chosen name). Dedupe so a user only appears once.
  const liveIdentities = useMemo<LiveIdentity[]>(() => {
    const seen = new Set<string>();
    const next: LiveIdentity[] = [];
    for (const live of liveUsers) {
      if (seen.has(live.userId)) continue;
      seen.add(live.userId);
      // Prefer what the sender put on the wire (works on public notes),
      // then the API lookup, then initials from the id.
      const profile = usersById?.[live.userId];
      const name = live.name ?? profile?.username ?? live.userId;
      const avatarUrl = live.avatar ?? profile?.getAvatarUrl();
      next.push({
        id: live.userId,
        color: live.color,
        name,
        avatarUrl,
        initials: avatarUrl ? undefined : displayInitials(name),
      });
    }
    return next;
  }, [liveUsers, usersById]);

  const status = useCollabStatus(noteId);
  const liveVisual = liveStatusVisual(status);
  const isOffline =
    status === "editingOffline" || status === "disconnected";
  const editingMode: EditingMode = isOffline ? "offline" : "live";
  // Only the selected segment tints its icon; the other stays neutral.
  const isLiveSelected = editingMode === "live";
  const isOfflineSelected = !isLiveSelected;
  // Live is primary only when it is both selected and connected; a
  // connecting/error state keeps its status colour.
  const liveIconColor = !isLiveSelected
    ? "inherit"
    : liveVisual.connected
      ? "primary.main"
      : liveVisual.color;

  const { versions, selectedVersion, selectVersion, clearSelection } =
    useVersionSelection(noteId);
  const { isRestoringVersion, restoreVersion } = useVersionRestore(noteId);

  const [versionsOpen, setVersionsOpen] = useState(false);

  // Clicking "Live" re-enters edit mode and drops any selected version
  // so the preview pane reflects what the live collab session is doing,
  // not a historical snapshot. When we were offline, also ask the
  // provider to reconnect.
  const handleLiveClick = useCallback(async () => {
    clearSelection();
    setWrite(true);
    if (!noteId || !isOffline) {
      return;
    }
    // Do not silently copy offline edits into the live doc. When the
    // local buffer diverged from the pre-offline server snapshot, hand
    // off to the merge modal so the user chooses what wins.
    const entry = isPublic
      ? (await import("../../hooks/usePublicNoteCollaboration")).getPublicCollabEntry(
          noteId,
        )
      : (await import("../../hooks/useNoteCollaboration")).getCollabEntry(
          noteId,
        );
    if (
      entry &&
      shouldPromptMergeOnReconnect({
        localMarkdown: useActiveNoteStore.getState().getContent(),
        preOfflineCloud: entry.preOfflineCloudMarkdown,
        hasUnsyncedLocalEdits: entry.hasUnsyncedLocalEdits,
      })
    ) {
      collabStatusStore
        .getState()
        .setConflict(
          noteId,
          "Your offline edits differ from the live version. Choose how to merge them.",
        );
      return;
    }
    if (isPublic) {
      const { goPublicOnline } = await import(
        "../../hooks/usePublicNoteCollaboration"
      );
      goPublicOnline(noteId);
    } else {
      const { goOnline } = await import("../../hooks/useNoteCollaboration");
      goOnline(noteId);
    }
  }, [clearSelection, setWrite, noteId, isOffline, isPublic]);

  // Switch the segmented control between the live collab session and
  // browser-only offline editing.
  const handleEditingModeChange = useCallback(
    async (_event: React.MouseEvent<HTMLElement>, next: string | null) => {
      if (!next || next === editingMode) {
        return;
      }
      if (next === "live") {
        await handleLiveClick();
        return;
      }
      if (!noteId) {
        return;
      }
      // Snapshot what is actually live right now so the conflict modal
      // compares against the same source the editor writes back. The
      // REST cache can be stale (live Y.Doc edits are never PATCHed on
      // every keystroke), which previously made the reconnect prompt
      // fire again for content the live doc already had. Fall back to
      // the cached note only when no editor is bound.
      const cached = queryClient.getQueryData<Note>(["notes", noteId]);
      const liveMarkdown = useActiveNoteStore.getState().getContent();
      const preOfflineCloudMarkdown =
        liveMarkdown ||
        cached?.content ||
        cached?.stripped_content ||
        null;
      if (isPublic) {
        const { goPublicOffline } = await import(
          "../../hooks/usePublicNoteCollaboration"
        );
        await goPublicOffline(noteId, "manual", preOfflineCloudMarkdown);
      } else {
        const { goOffline } = await import("../../hooks/useNoteCollaboration");
        await goOffline(noteId, "manual", preOfflineCloudMarkdown);
      }
    },
    [editingMode, handleLiveClick, noteId, isPublic],
  );

  // show only latest 3 Versions to keep view uncluttered
  const VISIBLE_LIMIT = 3;
  const [versionsExpanded, setVersionsExpanded] = useState(false);
  const visibleVersions = useMemo(() => {
    if (!versions) {
      return [];
    }
    return versionsExpanded ? versions : versions.slice(0, VISIBLE_LIMIT);
  }, [versions, versionsExpanded]);
  const totalVersions = versions?.length ?? 0;
  const hasMoreVersions = totalVersions > VISIBLE_LIMIT;

  // Once expanded, the toggle stays visible so the user can collapse back
  // to the latest 3 even after V1 is already on screen. Collapsed, we
  // only show the toggle when there's more history to reveal.
  const showVersionToggle = versionsExpanded || hasMoreVersions;

  return (
    <>
      <PanelSection
        title="Versions"
        collapsible
        defaultExpanded
        bordered
        leftEdgeHandle={leftEdgeHandle}
      >
        {editMode && (
          <Box>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", display: "block", mb: 0.5 }}
            >
              Currently editing
            </Typography>
            <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={editingMode}
                onChange={handleEditingModeChange}
                aria-label="Editing mode"
                sx={{
                  // "Button gray": a neutral, filled segmented control.
                  backgroundColor: "action.hover",
                  borderRadius: 1,
                  p: 0.25,
                  "& .MuiToggleButton-root": {
                    textTransform: "none",
                    px: 2,
                    py: 0.25,
                    border: 0,
                    borderRadius: 1,
                    "&.Mui-selected": {
                      backgroundColor: "background.paper",
                      "&:hover": { backgroundColor: "background.paper" },
                    },
                  },
                }}
              >
                <ToggleButton value="live" aria-label="Live" sx={{ gap: 1 }}>
                  {liveVisual.spinner ? (
                    <CircularProgress size={14} sx={{ color: liveIconColor }} />
                  ) : (
                    <WifiIcon
                      fontSize="small"
                      sx={{ color: liveIconColor }}
                    />
                  )}
                  Live
                </ToggleButton>
                <ToggleButton
                  value="offline"
                  aria-label="Offline"
                  sx={{ gap: 1 }}
                >
                  <WifiOffIcon
                    fontSize="small"
                    sx={{
                      color: isOfflineSelected ? "primary.main" : "inherit",
                    }}
                  />
                  offline
                </ToggleButton>
              </ToggleButtonGroup>
              {/* The message describes the Live connection, so it only
                  applies while Live is the selected segment. */}
              {isLiveSelected && !liveVisual.connected && status !== "idle" && (
                <Typography variant="caption" sx={{ color: liveVisual.color }}>
                  {liveVisual.label}
                </Typography>
              )}
            </Stack>
          </Box>
        )}
        <Timeline
          sx={{
            padding: 0,
            margin: 0,

            // Drop the default `::before` spacer (no TimelineOppositeContent).
            [`& .${timelineItemClasses.root}:before`]: {
              display: "none",
            },
          }}
        >
          {/* Offline/disconnected means we are not a live editor any
              more, so the draft entry must not list us (nor anyone
              else stale in the awareness store). */}
          <DraftVersionItem
            users={isOffline ? [] : liveIdentities}
            onClick={handleLiveClick}
          />
          {visibleVersions.map((version, index) => {
            // Blend ratio uses the full history so the chip color stays
            // stable as the user expands / collapses the timeline.
            const totalLen = versions?.length ?? 0;
            const isLastVisible = index === visibleVersions.length - 1;
            const isSelected =
              selectedVersion?.version_index === version.version_index;
            const bg = rgbToHex(
              blendColors(
                hexToRgb(theme.palette.background.paper),
                hexToRgb(theme.palette.secondary.main),
                1 - (index * 0.8) / totalLen,
              ),
            );
            const textColor = theme.palette.getContrastText(bg);
            const relativeDate = formatDistanceToNow(
              new Date(version.created_at),
              { addSuffix: true },
            );

            return (
              <TimelineItem
                key={version.version_index}
                sx={{
                  // Drop the 70px `TimelineItem` minimum so each row hugs its
                  // content. The connector stretches to fill what remains,
                  // so dots stay aligned in one column and the line between
                  // rows reaches the next dot.
                  minHeight: 0,
                }}
              >
                <TimelineSeparator>
                  {/* Top connector pairs with the bottom connector of the row
                      above (or the draft row's bottom connector for row 0) to
                      draw a continuous line down to this dot. */}
                  <TimelineConnector />
                  <TimelineDot
                    color={isSelected ? "primary" : "grey"}
                    sx={{
                      m: 0,
                      p: 0,
                      border: 0,
                      boxShadow: "none",
                      width: 1.5,
                      height: 1.5,
                    }}
                  />
                  {/* Bottom connector pairs with the top connector of the row
                      below to draw a continuous line down to the next dot;
                      the last visible row skips it so the timeline tail
                      matches the first row's leading spacer on `draft`. */}
                  {!isLastVisible && <TimelineConnector />}
                  {isLastVisible && !showVersionToggle && (
                    <Box sx={{ flexGrow: 1 }} />
                  )}
                </TimelineSeparator>
                <TimelineContent sx={{ p: 0, m: "auto 0" }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", py: 0.5 }}
                  >
                    <Button
                      onClick={async () => {
                        selectVersion(version);
                        const note = await queryClient.fetchQuery({
                          queryKey: ["versions", noteId, version.version_index],
                          queryFn: async () =>
                            await new NoteApi().getVersion(
                              noteId!,
                              version.version_index,
                            ),
                        });
                        await restoreVersion(version, note);
                      }}
                      sx={{
                        backgroundColor: bg,
                        color: textColor,
                        width: "fit-content",
                        height: "fit-content",
                        padding: theme.spacing(0.5, 2),
                        borderRadius: theme.shape.borderRadius,
                        whiteSpace: "nowrap",
                      }}
                    >
                      v{version.version_index}
                    </Button>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={relativeDate}
                    />
                    {isSelected && user && (
                      <UserHoverCard
                        user={{
                          id: user.id,
                          name: user.username,
                          color: theme.palette.primary.main,
                          avatarUrl: user.getAvatarUrl(),
                        }}
                      >
                        <Avatar
                          src={user.getAvatarUrl()}
                          alt={user.username}
                          sx={{ width: 24, height: 24 }}
                        />
                      </UserHoverCard>
                    )}
                  </Stack>
                </TimelineContent>
              </TimelineItem>
            );
          })}
          {showVersionToggle && (
            <TimelineItem sx={{ minHeight: 0 }}>
              <TimelineSeparator>
                <TimelineConnector />
                <TimelineDot
                  sx={{
                    m: 0,
                    p: 0,
                    border: 0,
                    boxShadow: "none",
                    bgcolor: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconButton
                    size="small"
                    aria-label={
                      versionsExpanded
                        ? "Show fewer versions"
                        : "Show more versions"
                    }
                    onClick={() => setVersionsExpanded((v) => !v)}
                    sx={{ p: 0.25 }}
                  >
                    {versionsExpanded ? (
                      <IconChevronUp size={18} />
                    ) : (
                      <IconChevronDown size={18} />
                    )}
                  </IconButton>
                </TimelineDot>
                {/* Stretch the trailing spacer so the chevron stays aligned
                    with the version dots above it, matching the layout the
                    last visible row uses when the toggle is hidden. */}
                <Box sx={{ flexGrow: 1 }} />
              </TimelineSeparator>
              <TimelineContent sx={{ p: 0, m: "auto 0" }}>
                <Button
                  size="small"
                  onClick={() => setVersionsExpanded((v) => !v)}
                  sx={{
                    textTransform: "none",
                    minWidth: 0,
                    p: 0,
                    color: "text.secondary",
                  }}
                >
                  {versionsExpanded ? "Show less" : "Show more"}
                </Button>
              </TimelineContent>
            </TimelineItem>
          )}
        </Timeline>
      </PanelSection>
      {/* Right-side version history drawer */}
      <NoteVersionsDrawer
        open={versionsOpen}
        noteId={noteId}
        onClose={() => setVersionsOpen(false)}
        onSelectVersion={selectVersion}
        onRestoreVersion={restoreVersion}
        selectedVersion={selectedVersion}
        isFetchingVersion={false}
        isRestoring={isRestoringVersion}
      />
    </>
  );
};

/**
 * The in-progress version entry. Renders the `draft` pill connected by
 * the timeline to the live authors editing the note.
 */
const DraftVersionItem = ({
  users,
  onClick,
}: {
  users: LiveIdentity[];
  onClick: () => void;
}) => {
  const { theme } = useThemeStore();

  return (
    <TimelineItem
      sx={{
        // Drop the 70px `TimelineItem` minimum so the row hugs the
        // content; the connector stretches to fill what remains so the
        // `draft` dot aligns with the version dots below it.
        minHeight: 0,
      }}
    >
      <TimelineSeparator>
        <TimelineConnector />
        <TimelineDot
          sx={{
            m: 0,
            p: 0,
            border: 0,
            boxShadow: "none",
            width: 1.5,
            height: 1.5,
          }}
        />
        <TimelineConnector />
      </TimelineSeparator>
      <TimelineContent sx={{ p: 0, m: "auto 0" }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", py: 0.5 }}
        >
          <Box
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }}
            sx={{
              cursor: "pointer",
              backgroundColor: "action.hover",
              border: `1px solid ${theme.palette.divider}`,
              width: "fit-content",
              height: "fit-content",
              padding: theme.spacing(0.5, 2),
              borderRadius: theme.shape.borderRadius,
            }}
          >
            draft
          </Box>
          <Grow
            in={users.length > 0}
            mountOnEnter
            unmountOnExit
            timeout={theme.transitions.duration.complex}
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <LiveUserAvatars users={users} />
            </Box>
          </Grow>
        </Stack>
      </TimelineContent>
    </TimelineItem>
  );
};

/**
 * Small hover card anchored to an avatar. Surfaces who the avatar
 * belongs to: their display name plus the underlying id. Public
 * users only carry a generated name (used as both), so the id is
 * suppressed when it would just repeat the name.
 */
const UserHoverCard = ({
  user,
  children,
}: {
  user: LiveIdentity;
  children: React.ReactElement;
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  // A short grace period lets the pointer travel from the avatar into
  // the card without the popover vanishing underneath it.
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setAnchorEl(null), 120);
  }, [cancelClose]);

  const handleEnter = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      cancelClose();
      setAnchorEl(event.currentTarget);
    },
    [cancelClose],
  );

  useEffect(() => cancelClose, [cancelClose]);

  const showId = user.id !== user.name;

  return (
    <>
      <Box
        component="span"
        onMouseEnter={handleEnter}
        onMouseLeave={scheduleClose}
        sx={{ display: "inline-flex", borderRadius: "50%" }}
      >
        {children}
      </Box>
      {/* A non-modal Popper, not a Popover. A Popover's full-screen
          invisible backdrop swallows pointer events, so the anchor
          fires mouseleave as soon as the card opens, the close timer
          runs, and the card flickers open/closed. Popper renders only
          the surface, so hover intent stays on the anchor and card. */}
      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement="bottom"
        modifiers={[{ name: "offset", options: { offset: [0, 4] } }]}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
      >
        <Paper
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          sx={{
            px: 1.5,
            py: 1,
            borderRadius: 2,
            boxShadow: 3,
            minWidth: 160,
          }}
        >
          <Stack spacing={0.75} sx={{ alignItems: "center" }}>
            <Avatar
              src={user.avatarUrl}
              alt={user.name}
              sx={{
                width: 44,
                height: 44,
                fontSize: 16,
                fontWeight: 600,
                bgcolor: user.avatarUrl ? undefined : user.color,
                color: user.avatarUrl ? undefined : "#fff",
              }}
            >
              {user.avatarUrl ? null : user.initials}
            </Avatar>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="subtitle2" sx={{ lineHeight: 1.3 }}>
                {user.name}
              </Typography>
              {showId && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    display: "block",
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                  }}
                >
                  {user.id}
                </Typography>
              )}
            </Box>
          </Stack>
        </Paper>
      </Popper>
    </>
  );
};

/**
 * Every live editor beside the draft entry. Logged-in users render
 * their avatar; public users render initials over their awareness
 * colour.
 */
const LiveUserAvatars = ({ users }: { users: LiveIdentity[] }) => {
  if (users.length === 0) {
    return null;
  }
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
    >
      {users.map((user) => (
        <UserHoverCard key={user.id} user={user}>
          <Avatar
            src={user.avatarUrl}
            alt={user.name}
            sx={{
              width: 28,
              height: 28,
              fontSize: 12,
              fontWeight: 600,
              bgcolor: user.avatarUrl ? undefined : user.color,
              color: user.avatarUrl ? undefined : "#fff",
            }}
          >
            {user.avatarUrl ? null : user.initials}
          </Avatar>
        </UserHoverCard>
      ))}
    </Stack>
  );
};
