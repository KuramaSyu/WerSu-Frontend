import { Avatar, Box, Button, Grid, Stack } from "@mui/material";
import Timeline from "@mui/lab/Timeline";
import TimelineItem, { timelineItemClasses } from "@mui/lab/TimelineItem";
import TimelineSeparator from "@mui/lab/TimelineSeparator";
import TimelineConnector from "@mui/lab/TimelineConnector";
import TimelineOppositeContent from "@mui/lab/TimelineOppositeContent";
import TimelineContent, {
  timelineContentClasses,
} from "@mui/lab/TimelineContent";
import TimelineDot from "@mui/lab/TimelineDot";
import { useThemeStore } from "../../zustand/useThemeStore";
import { IconDropletFilled } from "@tabler/icons-react";
import { IconArrowNarrowRightDashed } from "@tabler/icons-react";
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
import { formatDistanceToNow } from "date-fns";
import type { Note } from "../../api/models/search";
import { IconArrowNarrowRight } from "@tabler/icons-react";
import { queryClient } from "../../api/queryClient";
import { useNoteVersion } from "../../api/queries/useNoteQueries";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { color } from "@uiw/react-codemirror/esm/getDefaultExtensions.js";

export interface VersionInfoProps {
  noteId: string | undefined;
}

export const VersionInfo: React.FC<VersionInfoProps> = ({ noteId }) => {
  const { theme } = useThemeStore();
  const { setMessage } = useInfoStore();
  const { setTitle, setContent, save } = useActiveNoteStore();

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
  console.log("Live users:", liveUsers);
  const { data: usersById } = useUsers(userIds);
  console.log("Users by ID:", usersById);

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
  const { data: selectedVersionContent } = useNoteVersion(
    noteId,
    selectedVersion?.version_index,
  );

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

  const showLiveVersion = true;
  return (
    <>
      <Timeline
        sx={{
          padding: 0,
          margin: 0,
        }}
      >
        {showLiveVersion && (
          <LiveVersionItem users={Object.values(usersById ?? {})} />
        )}
        {versions?.map((version, index) => {
          const len = versions?.length ?? 0;
          const bg = theme.blendWithContrast(
            theme.palette.secondary.dark,
            0 + index / len,
            "secondary",
          );
          const textColor = theme.palette.getContrastText(bg);

          return (
            <TimelineItem key={version.version_index}>
              <TimelineOppositeContent
                // align="right"
                variant="body2"
                // sx={{
                //   color: "text.secondary",
                //   m: "auto 0",
                // }}
              >
                {selectedVersion?.version_index === version.version_index &&
                user ? (
                  <Stack
                    direction={"row"}
                    sx={{ alignItems: "center" }}
                    spacing={2}
                  >
                    <AvatarOrAvatarGroup users={[user]} />
                    <IconArrowNarrowRight
                      stroke={2}
                      color={theme.palette.text.secondary}
                    />
                  </Stack>
                ) : (
                  formatDistanceToNow(new Date(version.created_at), {
                    addSuffix: true,
                  })
                )}
              </TimelineOppositeContent>
              <TimelineSeparator>
                <TimelineDot></TimelineDot>
                <TimelineConnector />
              </TimelineSeparator>
              <TimelineContent>
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

                    // display: "flex",
                  }}
                >
                  v{version.version_index}
                </Button>
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>
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

const LiveVersionItem = ({ users }: { users: DiscordUser[] }) => {
  const { theme } = useThemeStore();

  return (
    <TimelineItem>
      <TimelineOppositeContent>
        <Stack direction={"row"} sx={{ justifyContent: "flex-end" }}>
          <AvatarOrAvatarGroup users={users} />
          {users.length > 0 && (
            <Box>
              <IconArrowNarrowRightDashed color={theme.palette.common.white} />
            </Box>
          )}
        </Stack>
      </TimelineOppositeContent>
      <TimelineSeparator>
        <TimelineDot></TimelineDot>
        <TimelineConnector />
      </TimelineSeparator>
      <TimelineContent>
        <Box
          sx={{
            backgroundColor: "transparent",
            border: `2px dashed ${theme.palette.secondary.main}`,
            width: "fit-content",
            height: "fit-content",
            padding: theme.spacing(0.5, 2),
            borderRadius: theme.shape.borderRadius,
            // display: "flex",
          }}
        >
          Live
        </Box>
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
