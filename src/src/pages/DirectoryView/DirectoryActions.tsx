import React, { useState } from "react";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Stack,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useFavouritesStore } from "../../zustand/useFavouritesStore";
import { ConfirmationModal } from "../Settings/ConfirmationModal";
import type { HirarchyItem } from "../../models/HirarchyItem";
import type { CascadePreview } from "./DirectoryFeatures.hook";
import { TooltipButton } from "../../components/ColoredCollapseButton";
import { useThemeStore } from "../../zustand/useThemeStore";
import CreateFab from "../../components/CreateFab";

export interface DirectoryActionsProps {
  currentNode: HirarchyItem;
  cascadePreview: CascadePreview;
  handleCreateNote: () => void;
  handleCreateSubdirectory: () => void;
  handleRenameDirectory: () => void;
  handleDeleteDirectory: () => Promise<boolean>;
}

/**
 * Body of the delete confirmation dialog.
 *
 * Mirrors the cascade preview that used to live in the right panel:
 * how many notes live directly in this directory, how many
 * subdirectories are nested inside, and the grand total. Renders
 * nothing extra when the directory is empty so empty deletes stay
 * short.
 */
const DeletePreviewMessage: React.FC<{
  directoryName: string;
  preview: CascadePreview;
}> = ({ directoryName, preview }) => {
  const { directNotes, subdirectories, totalSubdirectories, totalNotes } =
    preview;

  if (totalNotes === 0 && totalSubdirectories === 0) {
    return (
      <p style={{ fontSize: "0.8rem" }}>
        {directoryName} is empty. Deleting it removes only the directory itself.
      </p>
    );
  }

  const noteWord = (n: number) => (n === 1 ? "note" : "notes");
  const subWord = (n: number) => (n === 1 ? "subdirectory" : "subdirectories");

  return (
    <Stack spacing={1.5}>
      <Box>
        <p style={{ fontSize: "0.8rem" }}>Contents:</p>
        <ul>
          {directNotes.length > 0 && (
            <li>
              {directNotes.length} {noteWord(directNotes.length)}
            </li>
          )}
          {subdirectories.map((sub) => (
            <li key={sub.getId()}>{sub.getName()}</li>
          ))}
          {totalSubdirectories > 0 && (
            <li>
              {totalSubdirectories} {subWord(totalSubdirectories)}
            </li>
          )}
        </ul>
      </Box>
      {totalNotes > 0 && (
        <p style={{ fontSize: "0.8rem" }}>
          Total: {totalNotes} {noteWord(totalNotes)} lost.
        </p>
      )}
    </Stack>
  );
};

/**
 * Two speed dials and FABs for directory-level actions.
 */
export const DirectoryActions: React.FC<DirectoryActionsProps> = ({
  currentNode,
  cascadePreview,
  handleCreateNote,
  handleCreateSubdirectory,
  handleRenameDirectory,
  handleDeleteDirectory,
}) => {
  const { id: directoryId } = useParams();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  // Softened primary that drives the speed-dial sub-items. A small
  // `blendWithContrast` amount keeps the items on-theme but distinct
  // from the pure `primary.main` used for the FABs.
  const actionColor = theme.palette.secondary.main;
  const isRoot = currentNode.getId() === "root";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isFavourite = useFavouritesStore((s) =>
    directoryId ? Boolean(s.directories[directoryId]) : false,
  );
  const toggleDirectory = useFavouritesStore((s) => s.toggleDirectory);

  const openDeleteDialog = () => {
    setDeleteError(null);
    setConfirmDeleteOpen(true);
  };

  const runDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const ok = await handleDeleteDirectory();
      if (ok) {
        setConfirmDeleteOpen(false);
        navigate("/");
      } else {
        setDeleteError("Failed to delete directory. Please try again.");
      }
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Unknown error while deleting.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box
      sx={{
        position: "absolute",
        right: theme.spacing(2),
        bottom: theme.spacing(2),
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 2,
        zIndex: (theme) => theme.zIndex.appBar + 2,
      }}
    >
      <Box
        sx={{ pb: 1 }} // pb to center items manually with settings dial (center does not work because of the FAB's extended form)
      >
        <CreateFab
          onCreateNote={handleCreateNote}
          onCreateDirectory={handleCreateSubdirectory}
        />
      </Box>
      <SpeedDial
        ariaLabel="Directory settings"
        icon={<SpeedDialIcon open={settingsOpen} icon={<SettingsIcon />} />}
        direction="up"
        open={settingsOpen}
        onOpen={() => setSettingsOpen(true)}
        onClose={() => setSettingsOpen(false)}
        FabProps={{ color: "secondary" }}
      >
        <SpeedDialAction
          icon={
            <TooltipButton
              color={actionColor}
              tooltipTitle="Edit directory"
              disabled={isRoot}
              onClick={() => {
                if (!isRoot) handleRenameDirectory();
                setSettingsOpen(false);
              }}
            >
              <MenuBookIcon fontSize="small" />
            </TooltipButton>
          }
        />
        <SpeedDialAction
          icon={
            <TooltipButton
              color={actionColor}
              tooltipTitle={isFavourite ? "Unfavourite" : "Favourite"}
              disabled={isRoot}
              onClick={() => {
                if (!isRoot && directoryId) toggleDirectory(directoryId);
                setSettingsOpen(false);
              }}
            >
              {isFavourite ? (
                <StarIcon fontSize="small" />
              ) : (
                <StarBorderIcon fontSize="small" />
              )}
            </TooltipButton>
          }
        />
        <SpeedDialAction
          icon={
            <TooltipButton
              color={actionColor}
              tooltipTitle="Delete directory"
              disabled={isRoot}
              onClick={() => {
                if (!isRoot) openDeleteDialog();
                setSettingsOpen(false);
              }}
            >
              <DeleteIcon fontSize="small" />
            </TooltipButton>
          }
        />
      </SpeedDial>
      <ConfirmationModal
        title="Delete this directory?"
        message={
          <DeletePreviewMessage
            directoryName={currentNode.getName()}
            preview={cascadePreview}
          />
        }
        confirmLabel="Delete"
        maxWidth="sm"
        open={confirmDeleteOpen}
        confirming={deleting}
        errorMessage={deleteError}
        onCancel={() => {
          if (!deleting) {
            setConfirmDeleteOpen(false);
          }
        }}
        onConfirm={() => void runDelete()}
      />
    </Box>
  );
};
