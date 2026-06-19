import { Avatar, Box, Grid, Stack } from "@mui/material";
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
import { useUsers } from "../../api/queries/useUser";
import { useLiveUsers } from "../../zustand/useLiveUsersStore";
import { useState } from "react";
import type { NoteVersionSummaryReply } from "../../api/models/activity";
import { NoteApi } from "../../api/NoteApi";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { markdownToProsemirror, useEditorContext } from "./Editor";
import { NoteVersionsDrawer } from "../../components/NoteVersionsDrawer";

export interface VersionInfoProps {
  noteId: string | undefined;
}

export const VersionInfo: React.FC<VersionInfoProps> = ({ noteId }) => {
  const { theme } = useThemeStore();
  const { setMessage } = useInfoStore();
  const { title, save } = useEditorContext();

  const liveUsers = useLiveUsers(noteId);
  console.log("Live users:", liveUsers);
  const { data: usersById } = useUsers(liveUsers.map((user) => user.userId));
  console.log("Users by ID:", usersById);
  // Controls the version history drawer.
  const [versionsOpen, setVersionsOpen] = useState(false);
  // Currently selected version metadata + content snapshot.
  const [selectedVersion, setSelectedVersion] =
    useState<NoteVersionSummaryReply | null>(null);
  const [selectedVersionContent, setSelectedVersionContent] = useState<
    string | null
  >(null);
  // Loading state for fetching a specific version.
  const [isFetchingVersion, setIsFetchingVersion] = useState(false);
  // Loading state for restore flow.
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);

  // Loads the content for a selected version into the preview panel.
  const handleSelectVersion = async (version: NoteVersionSummaryReply) => {
    if (!noteId) {
      return;
    }
    setSelectedVersion(version);
    setIsFetchingVersion(true);
    try {
      const versionNote = await new NoteApi().getVersion(
        noteId,
        version.version_index,
      );
      if (!versionNote) {
        setMessage(new SnackbarUpdateImpl("Version not available", "error"));
        return;
      }
      setSelectedVersionContent(
        versionNote.content || versionNote.stripped_content || "",
      );
    } catch (error) {
      console.error("Failed to load version", error);
      setMessage(new SnackbarUpdateImpl("Failed to load version", "error"));
    } finally {
      setIsFetchingVersion(false);
    }
  };

  // Restores a version by saving its content as the latest note state.
  const handleRestoreVersion = async (version: NoteVersionSummaryReply) => {
    if (!noteId) {
      return;
    }
    setIsRestoringVersion(true);
    try {
      let content = selectedVersionContent;
      let restoredTitle = title;
      if (selectedVersion?.version_id !== version.version_id || !content) {
        const versionNote = await new NoteApi().getVersion(
          noteId,
          version.version_index,
        );
        if (!versionNote) {
          setMessage(new SnackbarUpdateImpl("Version not available", "error"));
          return;
        }
        content = versionNote.content || versionNote.stripped_content || "";
        restoredTitle = versionNote.title || restoredTitle;
        setSelectedVersionContent(content);
      }

      await save(restoredTitle, content);
      setMessage(new SnackbarUpdateImpl("Version restored", "success"));
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
          // [`& .${timelineContentClasses.root}`]: {
          //   flex: 0.2,
          // },

          padding: 0,
          margin: 0,
        }}
      >
        {showLiveVersion && (
          <LiveVersionItem users={Object.values(usersById ?? {})} />
        )}
        <TimelineItem>
          <TimelineOppositeContent
            // align="right"
            variant="body2"
            sx={{
              color: "text.secondary",
              m: "auto 0",
            }}
          >
            9:30 am
          </TimelineOppositeContent>
          <TimelineSeparator>
            <TimelineDot></TimelineDot>
            <TimelineConnector />
          </TimelineSeparator>
          <TimelineContent>
            <Box
              sx={{
                backgroundColor: theme.palette.primary.main,
                width: "fit-content",
                height: "fit-content",
                padding: theme.spacing(0.5, 2),
                borderRadius: theme.shape.borderRadius,
                whiteSpace: "nowrap",
                // display: "flex",
              }}
            >
              V11
            </Box>
          </TimelineContent>
        </TimelineItem>
        <TimelineItem>
          <TimelineOppositeContent />
          <TimelineSeparator>
            <TimelineDot />
            <TimelineConnector />
          </TimelineSeparator>
          <TimelineContent>Code</TimelineContent>
        </TimelineItem>
        <TimelineItem>
          <TimelineSeparator>
            <TimelineDot />
          </TimelineSeparator>
          <TimelineContent>Sleep</TimelineContent>
        </TimelineItem>
      </Timeline>
      {/* Right-side version history drawer */}
      <NoteVersionsDrawer
        open={versionsOpen}
        noteId={noteId}
        onClose={() => setVersionsOpen(false)}
        onSelectVersion={handleSelectVersion}
        onRestoreVersion={handleRestoreVersion}
        selectedVersion={selectedVersion}
        selectedContent={selectedVersionContent}
        isFetchingVersion={isFetchingVersion}
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
          <Box>
            <IconArrowNarrowRightDashed color={theme.palette.common.white} />
          </Box>
        </Stack>
      </TimelineOppositeContent>
      <TimelineSeparator>
        <TimelineDot></TimelineDot>
        <TimelineConnector />
      </TimelineSeparator>
      <TimelineContent>
        <Box
          sx={{
            backgroundColor: theme.palette.secondary.dark,
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
