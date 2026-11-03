import React, { useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import HistoryIcon from "@mui/icons-material/History";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StarIcon from "@mui/icons-material/Star";
import {
  usePanelSize,
  useLeftPanel,
  useRightPanel,
} from "../../LayoutProvider";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { PanelSection } from "../../components/Panels/PanelSection";
import { RecentActivityPanel } from "../../components/RecentActivity/Main";
import {
  FrequentlyUsedPanel,
  LastUsedPanel,
} from "../../components/FrequentlyUsed/Main";
import { CreateNote } from "../MainPage/CreateNote";
import { CreateDirectoryModal } from "../MainPage/CreateDirectory";
import {
  FavouriteDirectories,
  useFavouriteDirectoryIds,
} from "./FavouriteDirectories";
import { AllDirectories } from "./AllDirectories";
import { HomeGreeting } from "./HomeGreeting";
import { NotesTabs } from "./NotesTabs";
import { useNotesByScope } from "../../api/queries/useNotesByScope";
import { useCreateModalsFromUrl } from "../../hooks/useCreateModalsFromUrl";
import { usePageHoldShortcuts } from "../../hooks/usePageHoldShortcuts";
import { HoldKeyActionBar } from "../../components/HoldKeyActionBar";
import { CreateActions } from "../../components/CreateActions";

/** Home page: recent activity on the left, favourites + all dirs in the body. */
export const HomePage: React.FC = () => {
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [createDirectoryOpen, setCreateDirectoryOpen] = useState(false);

  // Hold-to-run shortcuts for this page (see config/shortcuts.json).
  // Search (k), home (h), and navigate-back (Esc) are global; see
  // GlobalShortcuts.
  const holdActions = usePageHoldShortcuts("home", {
    "home.newDirectory": () => setCreateDirectoryOpen(true),
    "home.newNote": () => setCreateNoteOpen(true),
  });

  useCreateModalsFromUrl({
    setCreateNoteOpen,
    setCreateDirectoryOpen,
  });

  // Shared by the Recent notes list and the notes tabs so both sections
  // resolve from a single cached request.
  const { data: recentNotes } = useNotesByScope({ limit: 50 });

  // Only surface the favourites section once the user actually has one on
  // the current shelf; the empty-state copy lives here rather than in a
  // permanently visible section.
  const favouriteDirectoryIds = useFavouriteDirectoryIds();

  useRightPanel(null);
  usePanelSize({ left: "clamp(20rem, 25vw, 30rem)" });
  useLeftPanel(
    <UpperPanel>
      <PanelSection
        title="Last used"
        titleIcon={<HistoryIcon fontSize="small" />}
      >
        <LastUsedPanel title={null} />
      </PanelSection>
      <PanelSection
        title="Frequently used"
        titleIcon={<LocalFireDepartmentIcon fontSize="small" />}
      >
        <FrequentlyUsedPanel title={null} />
      </PanelSection>
      <PanelSection
        title="Recent activity"
        titleIcon={<ScheduleIcon fontSize="small" />}
      >
        <RecentActivityPanel target={{ type: "root" }} />
      </PanelSection>
    </UpperPanel>,
  );

  return (
    <Box
      sx={{
        width: "100%",
        // Grow with the content instead of clamping to the viewport. A
        // fixed `height: 100%` lets the notes-tabs section overflow past
        // the AppShell's bottom-bar clearance padding, so the last rows
        // end up behind the mobile bottom bar and cannot be scrolled clear.
        minHeight: "100%",
        p: 1,
        // No nested scroll container: let the AppShell's main content box
        // own the scroll. That keeps the mobile bottom bar's scroll-hide
        // watchdog working on this route (it observes that box), matching
        // the directory and note pages.
        // The app has no global border-box reset, so under the default
        // `content-box` this `width: 100%` + padding would render 16px
        // wider than the scroll container and make the page scroll
        // horizontally. Keep padding inside the width.
        boxSizing: "border-box",
      }}
    >
      <Stack spacing={3}>
        <HomeGreeting />

        {favouriteDirectoryIds.length > 0 && (
          <Stack direction="column" spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <StarIcon color="primary" fontSize="small" />
              <Typography variant="h5" color="textPrimary">
                Favourite directories
              </Typography>
            </Stack>
            <FavouriteDirectories />
          </Stack>
        )}

        <Stack direction="column" spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <FolderIcon color="primary" fontSize="small" />
            <Typography variant="h5" color="textPrimary">
              All directories
            </Typography>
          </Stack>
          <AllDirectories />
        </Stack>

        <NotesTabs notes={recentNotes} />
      </Stack>
      <CreateActions
        onCreateNote={() => setCreateNoteOpen(true)}
        onCreateDirectory={() => setCreateDirectoryOpen(true)}
      />
      <CreateNote open={createNoteOpen} onOpenChange={setCreateNoteOpen} />
      <CreateDirectoryModal
        open={createDirectoryOpen}
        onOpenChange={setCreateDirectoryOpen}
        mode="create"
      />
      <HoldKeyActionBar
        active={holdActions.length > 0}
        capture={false}
        actions={holdActions}
      />
    </Box>
  );
};

export default HomePage;
