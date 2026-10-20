import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Grid,
  Grow,
  IconButton,
  Stack,
} from "@mui/material";
import { PanelSection } from "../../components/Panels/PanelSection";
import Timeline from "@mui/lab/Timeline";
import TimelineItem, { timelineItemClasses } from "@mui/lab/TimelineItem";
import TimelineSeparator from "@mui/lab/TimelineSeparator";
import TimelineConnector from "@mui/lab/TimelineConnector";
import TimelineContent, {
  timelineContentClasses,
} from "@mui/lab/TimelineContent";
import TimelineDot from "@mui/lab/TimelineDot";
import { useThemeStore } from "../../zustand/useThemeStore";
import {
  IconChevronDown,
  IconChevronUp,
  IconDropletFilled,
} from "@tabler/icons-react";
import type { WersuUser, WersuUserImpl } from "../../components/DiscordLogin";
import { useUser, useUsers } from "../../api/queries/useUser";
import { useLiveUsers, type LiveUser } from "../../zustand/useLiveUsersStore";
import { useMemo, useState } from "react";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import { NoteApi } from "../../api/NoteApi";
import { NoteVersionsDrawer } from "../../components/NoteVersionsDrawer";
import { formatDistanceToNow } from "date-fns";
import { queryClient } from "../../api/queryClient";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { color } from "@uiw/react-codemirror/esm/getDefaultExtensions.js";
import { blendColors, hexToRgb, rgbToHex } from "../../utils/blendWithContrast";
import { CollabStatusBadge } from "./CollabStatusBadge";
import { useVersionSelection, useVersionRestore } from "./VersionInfo.hooks";

export interface VersionInfoProps {
  noteId: string | undefined;
}

export const VersionInfo: React.FC<VersionInfoProps> = ({ noteId }) => {
  const { theme } = useThemeStore();
  const { setWrite } = useEditorSettings();

  const { data: user } = useUser();

  const liveUsers = useLiveUsers(noteId);
  const userIds = useMemo(
    () => [...new Set(liveUsers.map((u) => u.userId))],
    [liveUsers],
  );
  const { data: usersById } = useUsers(userIds);

  const { versions, selectedVersion, selectVersion, clearSelection } =
    useVersionSelection(noteId);
  const { isRestoringVersion, restoreVersion } = useVersionRestore(noteId);

  const [versionsOpen, setVersionsOpen] = useState(false);

  // Clicking "Live" re-enters edit mode and drops any selected version
  // so the preview pane reflects what the live collab session is doing,
  // not a historical snapshot.
  const handleLiveClick = () => {
    clearSelection();
    setWrite(true);
  };

  const showLiveVersion = true;

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
      <PanelSection title="Versions" collapsible defaultExpanded>
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
          {showLiveVersion && (
            <LiveVersionItem
              users={Object.values(usersById ?? {})}
              onClick={handleLiveClick}
            />
          )}
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
                      above (or `Live`'s bottom connector for row 0) to draw a
                      continuous line down to this dot. */}
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
                      matches the first row's leading spacer on `Live`. */}
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
                      <Avatar
                        src={user.getAvatarUrl()}
                        sx={{ width: 24, height: 24 }}
                      />
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

const LiveVersionItem = ({
  users,
  onClick,
}: {
  users: WersuUser[];
  onClick: () => void;
}) => {
  const { theme } = useThemeStore();
  const { editMode } = useEditorSettings();

  return (
    <TimelineItem
      sx={{
        // Drop the 70px `TimelineItem` minimum so the row hugs the
        // content; the connector stretches to fill what remains so the
        // `Live` dot aligns with the v0 dot below it.
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
              backgroundColor: "transparent",
              border: `2px dashed ${theme.palette.secondary.main}`,
              width: "fit-content",
              height: "fit-content",
              padding: theme.spacing(0.5, 2),
              borderRadius: theme.shape.borderRadius,
            }}
          >
            Live
          </Box>
          {/* Collab batch sits right next to the user icons in
              the live row so a viewer can see the connection
              status + live-user count at a glance. Hidden in
              read mode: the provider is closed there, so the
              status chip would always read "disconnected".

              `Grow`'s child must be a single DOM element so the
              ref lands on a real node -- otherwise `handleEnter`
              reads `scrollTop` on `null` and crashes. The
              component children (`AvatarOrAvatarGroup`,
              `CollabStatusBadge`) are function components and
              don't forward refs; wrap them in a `<Box>` so Grow
              gets a DOM ref to measure. */}
          <Grow
            in={users.length > 0}
            mountOnEnter
            unmountOnExit
            timeout={theme.transitions.duration.complex}
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <AvatarOrAvatarGroup users={users} />
            </Box>
          </Grow>
          <Grow
            in={editMode}
            mountOnEnter
            unmountOnExit
            timeout={theme.transitions.duration.complex}
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <CollabStatusBadge />
            </Box>
          </Grow>
        </Stack>
      </TimelineContent>
    </TimelineItem>
  );
};

const AvatarOrAvatarGroup = ({ users }: { users: WersuUser[] }) => {
  if (users.length === 0) {
    return null;
  }
  if (users.length === 1) {
    return (
      <Avatar
        src={users[0].getAvatarUrl()}
        sx={{
          width: 40,
          height: 40,
        }}
      />
    );
  }
  return <AvatarGroup users={users} />;
};

/**
 * Gridlike rounded Icon displaying the a group of users
 * @param param0
 * @returns
 */
const AvatarGroup = ({ users }: { users: WersuUser[] }) => {
  return (
    <Grid
      container
      sx={{
        gridTemplateColumns: "repeat(2, 1fr)",
        width: 40,
        height: 40,
      }}
    >
      {users.slice(0, 4).map((user) => (
        <Avatar
          src={user.getAvatarUrl()}
          sx={{
            width: 20,
            height: 20,
          }}
        />
      ))}
    </Grid>
  );
};
