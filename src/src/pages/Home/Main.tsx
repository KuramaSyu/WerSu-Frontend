import React, { useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CreateIcon from "@mui/icons-material/Create";
import FolderIcon from "@mui/icons-material/Folder";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StarIcon from "@mui/icons-material/Star";
import { useNavigate } from "react-router-dom";
import {
  usePanelSize,
  useLeftPanel,
  useRightPanel,
  useLayout,
} from "../../LayoutProvider";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { PanelSection } from "../../components/Panels/PanelSection";
import { PanelButtons } from "../../components/Panels/PanelButtons";
import { NavigationSection } from "../../components/Panels/NavigationSection";
import { DirectorySideView } from "../MainPage/DirectorySideView";
import { RecentActivityPanel } from "../../components/RecentActivity/Main";
import { FrequentlyUsedPanel } from "../../components/FrequentlyUsed/Main";
import { CreateNote } from "../MainPage/CreateNote";
import { DirectoryApi } from "../../api/DirectoryApi";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { FavouriteDirectories } from "./FavouriteDirectories";
import { AllDirectories } from "./AllDirectories";
import { M3, M4 } from "../../statics";
import { useRequireAuth } from "../../hooks/useRequireAuth";
import CreateFab from "../../components/CreateFab";

/**
 * Home page.
 *
 * Layout:
 *   - left panel: navigation, actions (new directory / new note), recent
 *     activity, then the directory tree at the bottom
 *   - body: favourite directories section
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const upsertDirectory = useDirectoryStore((s) => s.upsertDirectory);
  const setMessage = useInfoStore((s) => s.setMessage);
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const { rightPanelOpen } = useLayout();
  useRequireAuth();

  const handleCreateDirectory = async (): Promise<void> => {
    const nextName = window.prompt("New directory name");
    if (!nextName || nextName.trim() === "") {
      return;
    }

    const trimmedName = nextName.trim();
    const created = await new DirectoryApi().create({
      name: trimmedName,
      display_name: trimmedName,
    });

    if (!created) {
      setMessage(new SnackbarUpdateImpl("Failed to create directory", "error"));
      return;
    }

    upsertDirectory(created);
    setMessage(new SnackbarUpdateImpl("Directory created", "success"));
    navigate(`/d/${created.id}`);
  };

  useRightPanel(null);
  usePanelSize({ left: "clamp(20rem, 25vw, 30rem)" });
  useLeftPanel(
    <UpperPanel>
      <NavigationSection />
      <PanelSection title="Actions" showDivider>
        <PanelButtons>
          <PanelButtons.Secondary
            startIcon={<AddIcon />}
            onClick={() => void handleCreateDirectory()}
          >
            New directory
          </PanelButtons.Secondary>
          <PanelButtons.Primary
            startIcon={<CreateIcon />}
            onClick={() => setCreateNoteOpen(true)}
          >
            New note
          </PanelButtons.Primary>
        </PanelButtons>
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
      <DirectorySideView />
    </UpperPanel>,
  );

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
            <Typography variant="h5">Favourite directories</Typography>
          </Stack>
          <FavouriteDirectories />
        </Stack>

        <Stack direction="column" spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <FolderIcon color="primary" fontSize="small" />
            <Typography variant="h5">All directories</Typography>
          </Stack>
          <AllDirectories />
        </Stack>
      </Stack>
      <Box
        sx={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: (theme) => theme.zIndex.appBar + 2,
        }}
      >
        <CreateFab
          onCreateNote={() => setCreateNoteOpen(true)}
          onCreateDirectory={() => void handleCreateDirectory()}
        />
      </Box>
      <CreateNote open={createNoteOpen} onOpenChange={setCreateNoteOpen} />
    </Box>
  );
};

export default HomePage;
