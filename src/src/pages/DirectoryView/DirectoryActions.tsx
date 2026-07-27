import React, { useState } from "react";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
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
import { ColoredCollapseButton } from "../../components/ColoredCollapseButton";
import { useThemeStore } from "../../zustand/useThemeStore";

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
const CascadePreviewMessage: React.FC<{
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
 * Two speed dials for directory-level actions.
 *
 * The two dials are stacked side-by-side and sit in the left panel
 * between the navigation section and the directory tree:
 *
 * - The `+` (plus) dial exposes the "new" actions: create note,
 *   create subdirectory.
 * - The `gear` (settings) dial exposes the per-directory settings:
 *   edit, toggle favourite, delete.
 *
 * The settings dial's mutation actions (`edit`, `favourite`, `delete`)
 * are no-ops when viewing the synthetic root, mirroring the
 * `disabled={isRoot}` behavior the toolbar used to enforce.
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
  const actionColor = theme.blendWithContrast("primary", 0.3);
  const isRoot = currentNode.getId() === "root";
  const [plusOpen, setPlusOpen] = useState(false);
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
    <>
      <Stack
        // Fixed to the bottom-right of the screen. The dials open
        // upward so they don't overflow the viewport. Two slots
        // (plus + settings) sit side-by-side with a small gap.
        // `alignItems: "flex-end"` aligns both dials to the bottom
        // of the row, so the FABs sit on the same baseline even
        // when the SpeedDial roots have slightly different
        // intrinsic heights (their `direction: 'up'` styles
        // apply a negative `marginBottom` to the actions
        // container, which can shift one root visually lower
        // than the other).
        sx={{
          position: "fixed",
          right: 24,
          bottom: 24,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 2,
          zIndex: (theme) => theme.zIndex.appBar + 2,
        }}
      >
        <SpeedDial
          ariaLabel="Create new"
          icon={<SpeedDialIcon open={plusOpen} icon={<AddIcon />} />}
          direction="up"
          open={plusOpen}
          onOpen={() => setPlusOpen(true)}
          onClose={() => setPlusOpen(false)}
        >
          <SpeedDialAction
            icon={
              <ColoredCollapseButton
                color={actionColor}
                whenSelected="New note"
                onClick={() => {
                  handleCreateNote();
                  setPlusOpen(false);
                }}
              >
                <NoteAddIcon fontSize="small" />
              </ColoredCollapseButton>
            }
          />
          <SpeedDialAction
            icon={
              <ColoredCollapseButton
                color={actionColor}
                whenSelected="New subdirectory"
                onClick={() => {
                  handleCreateSubdirectory();
                  setPlusOpen(false);
                }}
              >
                <CreateNewFolderIcon fontSize="small" />
              </ColoredCollapseButton>
            }
          />
        </SpeedDial>

        <SpeedDial
          ariaLabel="Directory settings"
          icon={<SpeedDialIcon open={settingsOpen} icon={<SettingsIcon />} />}
          direction="up"
          open={settingsOpen}
          onOpen={() => setSettingsOpen(true)}
          onClose={() => setSettingsOpen(false)}
        >
          <SpeedDialAction
            icon={
              <ColoredCollapseButton
                color={actionColor}
                whenSelected="Edit directory"
                disabled={isRoot}
                onClick={() => {
                  if (!isRoot) handleRenameDirectory();
                  setSettingsOpen(false);
                }}
              >
                <MenuBookIcon fontSize="small" />
              </ColoredCollapseButton>
            }
          />
          <SpeedDialAction
            icon={
              <ColoredCollapseButton
                color={actionColor}
                whenSelected={isFavourite ? "Unfavourite" : "Favourite"}
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
              </ColoredCollapseButton>
            }
          />
          <SpeedDialAction
            icon={
              <ColoredCollapseButton
                color={actionColor}
                whenSelected="Delete directory"
                disabled={isRoot}
                onClick={() => {
                  if (!isRoot) openDeleteDialog();
                  setSettingsOpen(false);
                }}
              >
                <DeleteIcon fontSize="small" />
              </ColoredCollapseButton>
            }
          />
        </SpeedDial>
      </Stack>

      <ConfirmationModal
        title="Delete this directory?"
        message={
          <CascadePreviewMessage
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
    </>
  );
};
