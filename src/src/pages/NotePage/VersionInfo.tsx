import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Grid,
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
import type {
  DiscordUser,
  DiscordUserImpl,
} from "../../components/DiscordLogin";
import { useUser, useUsers } from "../../api/queries/useUser";
import { useLiveUsers, type LiveUser } from "../../zustand/useLiveUsersStore";
import { useEffect, useMemo, useState } from "react";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import { NoteApi } from "../../api/NoteApi";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { NoteVersionsDrawer } from "../../components/NoteVersionsDrawer";
import { useNoteActivity } from "../../api/queries/recentActivity";
import { useNote } from "../../api/queries/useNoteQueries";
import { formatDistanceToNow } from "date-fns";
import type { Note } from "../../api/models/search";
import { queryClient } from "../../api/queryClient";
import { useNoteVersion } from "../../api/queries/useNoteQueries";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { color } from "@uiw/react-codemirror/esm/getDefaultExtensions.js";
import { blendColors, hexToRgb, rgbToHex } from "../../utils/blendWithContrast";

export interface VersionInfoProps {
  noteId: string | undefined;
}

export const VersionInfo: React.FC<VersionInfoProps> = ({ noteId }) => {
  const { theme } = useThemeStore();
  const { setMessage } = useInfoStore();
  const { setTitle, setContent, save } = useActiveNoteStore();
  const { setWrite } = useEditorSettings();

  const { data: user } = useUser();

  const liveUsers = useLiveUsers(noteId);
  // const liveUsers: LiveUser[] = [
  //   {
  //     userId: "123",
  //     color: "#ff0000",
  //   },
  // ];
  const userIds = useMemo(
    () => [...new Set(liveUsers.map((u) => u.userId))],
    [liveUsers],
  );
  const { data: usersById } = useUsers(userIds);

  // Controls the version history drawer.
  const [versionsOpen, setVersionsOpen] = useState(false);
  // Currently selected version metadata + content snapshot.
  const [selectedVersion, setSelectedVersion] =
    useState<NoteVersionSummaryReply | null>(null);

  const { data: versions } = useNoteActivity(noteId ?? "");

  // Loading state for restore flow.
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);

  // Loads the content for a selected version into the preview panel.
  const handleSelectVersion = async (version: NoteVersionSummaryReply) => {
    if (!noteId) {
      return;
    }
    setSelectedVersion(version);
  };

  // The auto-select effect below picks the latest version in read mode;
  // its content is already served by `useNote(noteId)`, so skip the
  // per-version fetch when the selection matches the latest index.
  const latestVersionIndex = versions?.[0]?.version_index;
  const isLatestSelected =
    selectedVersion?.version_index !== undefined &&
    selectedVersion.version_index === latestVersionIndex;
  const { data: fetchedSelectedVersionContent } = useNoteVersion(
    noteId,
    isLatestSelected ? undefined : selectedVersion?.version_index,
  );
  // Fall back to the `useNote(noteId)` cache for the latest version.
  const { data: cachedNote } = useNote(noteId);
  const selectedVersionContent: Note | undefined = isLatestSelected
    ? (cachedNote ?? undefined)
    : fetchedSelectedVersionContent;

  /*   clear user from an old version as soon as he enters the edit window.
  also select the latest version if he is not in editor mode e.g. read mode */
  useEffect(() => {
    console.log(
      "Users by ID or user changed, checking if selected version needs update",
    );
    if (!usersById || !user) {
      return;
    }

    const isEditing = usersById[user?.id] !== undefined;
    if (isEditing && selectedVersion !== null) {
      console.log("User is editing, clear selected version");
      setSelectedVersion(null);
      return;
    }
    // the user does not edit. if no version is selected, select the latest one for preview
    if (!isEditing && !selectedVersion && versions && versions.length > 0) {
      console.log("User is not editing, select latest version for preview");
      if (!selectedVersion && versions.length > 0) {
        setSelectedVersion(versions[0]);
      }
    }
  }, [usersById, selectedVersion]);

  // Restores a version by saving its content as the latest note state.
  const handleRestoreVersion = async (
    version: NoteVersionSummaryReply,
    note: Note | undefined,
  ) => {
    if (!noteId) {
      console.error("Note ID is required to restore version");
      return;
    }
    if (!note?.title || !note.content) {
      console.error("Current note data is incomplete");
      setMessage(
        new SnackbarUpdateImpl("Current note data is incomplete", "error"),
      );
      return;
    }
    setIsRestoringVersion(true);
    try {
      // await save(note?.title, note?.content);
      setTitle(note.title);
      setContent(note.content);
      setMessage(
        new SnackbarUpdateImpl(
          `Version ${version.version_index} in preview`,
          "success",
          undefined,
          "Press save to restore this version",
        ),
      );
    } catch (error) {
      console.error("Restore failed", error);
      setMessage(new SnackbarUpdateImpl("Failed to restore version", "error"));
    } finally {
      setIsRestoringVersion(false);
    }
  };

  // Clicking "Live" re-enters edit mode and drops any selected version
  // so the preview pane reflects what the live collab session is doing,
  // not a historical snapshot. `setSelectedVersion(null)` triggers the
  // "user is editing -> clear selected version" branch in the effect
  // above, which keeps the rest of the panel consistent.
  const handleLiveClick = () => {
    setSelectedVersion(null);
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
                        setSelectedVersion(version);
                        const note = await queryClient.fetchQuery({
                          queryKey: ["versions", noteId, version.version_index],
                          queryFn: async () =>
                            await new NoteApi().getVersion(
                              noteId!,
                              version.version_index,
                            ),
                        });
                        await handleRestoreVersion(version, note);
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
        onSelectVersion={handleSelectVersion}
        onRestoreVersion={handleRestoreVersion}
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
  users: DiscordUser[];
  onClick: () => void;
}) => {
  const { theme } = useThemeStore();

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
          {users.length > 0 && <AvatarOrAvatarGroup users={users} />}
        </Stack>
      </TimelineContent>
    </TimelineItem>
  );
};

const AvatarOrAvatarGroup = ({ users }: { users: DiscordUser[] }) => {
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
const AvatarGroup = ({ users }: { users: DiscordUser[] }) => {
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
