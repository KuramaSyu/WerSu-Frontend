import React, { useState } from "react";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CreateIcon from "@mui/icons-material/Create";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StarIcon from "@mui/icons-material/Star";
import { useNavigate } from "react-router-dom";
import {
  usePanelSize,
  useLeftPanel,
  useRightPanel,
} from "../../LayoutProvider";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { PanelSection } from "../../components/Panels/PanelSection";
import { NavigationSection } from "../../components/Panels/NavigationSection";
import { DirectorySideView } from "../MainPage/DirectorySideView";
import { RecentActivityPanel } from "../../components/RecentActivity/Main";
import { CreateNote } from "../MainPage/CreateNote";
import { DirectoryApi } from "../../api/DirectoryApi";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import useInfoStore, { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { FavouriteDirectories } from "./FavouriteDirectories";
import { M3 } from "../../statics";

/**
 * Home page.
 *
 * Layout:
 *   - left panel: navigation memento, directory tree, recent activity
 *   - body: favourite directories section
 *   - right panel: create-directory and create-note action buttons
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const upsertDirectory = useDirectoryStore((s) => s.upsertDirectory);
  const setMessage = useInfoStore((s) => s.setMessage);
  const [createNoteOpen, setCreateNoteOpen] = useState(false);

  usePanelSize({ left: "clamp(20rem, 25vw, 30rem)" });
  useLeftPanel(
    <UpperPanel>
      <NavigationSection />
      <DirectorySideView />
      <PanelSection
        title="Recent activity"
        titleIcon={<ScheduleIcon fontSize="small" />}
      >
        <RecentActivityPanel target={{ type: "root" }} />
      </PanelSection>
    </UpperPanel>,
  );

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

  useRightPanel(
    <Stack
      direction="row"
      spacing={1}
      sx={{ p: 1.5, justifyContent: "flex-end" }}
    >
      <Tooltip title="New directory">
        <IconButton
          color="primary"
          onClick={() => void handleCreateDirectory()}
        >
          <AddIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="New note">
        <IconButton color="primary" onClick={() => setCreateNoteOpen(true)}>
          <CreateIcon />
        </IconButton>
      </Tooltip>
    </Stack>,
  );

  return (
    <Box sx={{ width: "100%", height: "100%", p: 4, overflow: "auto" }}>
      <Stack spacing={M3}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <StarIcon color="primary" fontSize="small" />
          <Typography variant="h5">Favourite directories</Typography>
        </Stack>
        <FavouriteDirectories />
      </Stack>
      <CreateNote open={createNoteOpen} onOpenChange={setCreateNoteOpen} />
    </Box>
  );
};

export default HomePage;
