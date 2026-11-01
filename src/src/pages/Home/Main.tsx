import React, { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CreateIcon from "@mui/icons-material/Create";
import FolderIcon from "@mui/icons-material/Folder";
import HistoryIcon from "@mui/icons-material/History";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StarIcon from "@mui/icons-material/Star";
import {
  usePanelSize,
  useLeftPanel,
  useRightPanel,
  useLayout,
} from "../../LayoutProvider";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { PanelSection } from "../../components/Panels/PanelSection";
import { PanelButtons } from "../../components/Panels/PanelButtons";
import { NavigationSection } from "../../components/Panels/NavigationSection";
import { DirectorySideView } from "../MainPage/DirectorySideView";
import { RecentActivityPanel } from "../../components/RecentActivity/Main";
import {
  FrequentlyUsedPanel,
  LastUsedPanel,
} from "../../components/FrequentlyUsed/Main";
import { CreateNote } from "../MainPage/CreateNote";
import { CreateDirectoryModal } from "../MainPage/CreateDirectory";
import { FavouriteDirectories } from "./FavouriteDirectories";
import { AllDirectories } from "./AllDirectories";
import { M3, M4 } from "../../statics";
import { useCreateModalsFromUrl } from "../../hooks/useCreateModalsFromUrl";
import { useNavigateBack } from "../../hooks/useNavigateBack";
import { usePageHoldShortcuts } from "../../hooks/usePageHoldShortcuts";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import { HoldKeyActionBar } from "../../components/HoldKeyActionBar";
import CreateFab from "../../components/CreateFab";
import { FabSlot } from "../../components/FabSlot";

/** Home page: nav + recent activity on the left, favourites + all dirs in the body. */
export const HomePage: React.FC = () => {
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [createDirectoryOpen, setCreateDirectoryOpen] = useState(false);
  const {
    rightPanelOpen,
    leftPanelOpen,
    leftPanelUserOverride,
    setLeftPanelOpen,
  } = useLayout();
  const { isMobile } = useBreakpoint();
  const navigateBack = useNavigateBack();
  const setIsSearchOpen = useSearchNotesStore((s) => s.setIsDialogOpen);

  // Hold-to-run shortcuts for this page (see config/shortcuts.json).
  const holdActions = usePageHoldShortcuts("home", {
    "home.newDirectory": () => setCreateDirectoryOpen(true),
    "home.newNote": () => setCreateNoteOpen(true),
    "home.search": () => setIsSearchOpen(true),
    "home.back": navigateBack,
  });

  useCreateModalsFromUrl({
    setCreateNoteOpen,
    setCreateDirectoryOpen,
  });

  useRightPanel(null);
  usePanelSize({ left: "clamp(20rem, 25vw, 30rem)" });
  useLeftPanel(
    <UpperPanel>
      <NavigationSection />
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

  // Mobile: hide the left rail by default. The user can still open
  // it via the bottom-bar swipe-right gesture (sets the override).
  useEffect(() => {
    if (!isMobile) {
      return;
    }
    if (leftPanelUserOverride) {
      return;
    }
    if (leftPanelOpen) {
      setLeftPanelOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        p: 1,
        overflow: "auto",
      }}
    >
      <Stack spacing={3}>
        <Stack direction="column" spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <StarIcon color="primary" fontSize="small" />
            <Typography variant="h5" color="textPrimary">
              Favourite directories
            </Typography>
          </Stack>
          <FavouriteDirectories />
        </Stack>

        <Stack direction="column" spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <FolderIcon color="primary" fontSize="small" />
            <Typography variant="h5" color="textPrimary">
              All directories
            </Typography>
          </Stack>
          <AllDirectories />
        </Stack>
      </Stack>
      <FabSlot>
        <CreateFab
          onCreateNote={() => setCreateNoteOpen(true)}
          onCreateDirectory={() => setCreateDirectoryOpen(true)}
        />
      </FabSlot>
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
