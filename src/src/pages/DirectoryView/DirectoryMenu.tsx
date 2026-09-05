import React, { useState } from "react";
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate, useParams } from "react-router-dom";
import { useFavouritesStore } from "../../zustand/useFavouritesStore";
import { ConfirmationModal } from "../Settings/ConfirmationModal";
import type { HirarchyItem } from "../../models/HirarchyItem";
import type { CascadePreview } from "./DirectoryFeatures.hook";

export interface DirectoryMenuProps {
  currentNode: HirarchyItem;
  cascadePreview: CascadePreview;
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
 * 3-dot menu attached to the directory title.
 *
 * Houses the three non-create directory actions: rename, toggle
 * favourite, delete. The menu is disabled (items greyed) for the
 * root directory so the existing root-protective behaviour is
 * preserved after the speed-dial move.
 */
export const DirectoryMenu: React.FC<DirectoryMenuProps> = ({
  currentNode,
  cascadePreview,
  handleRenameDirectory,
  handleDeleteDirectory,
}) => {
  const { id: directoryId } = useParams();
  const navigate = useNavigate();
  const isRoot = currentNode.getId() === "root";

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isFavourite = useFavouritesStore((s) =>
    directoryId ? Boolean(s.directories[directoryId]) : false,
  );
  const toggleDirectory = useFavouritesStore((s) => s.toggleDirectory);

  const openMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const closeMenu = () => setAnchorEl(null);

  const openDeleteDialog = () => {
    closeMenu();
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
      <IconButton
        aria-label="Directory actions"
        onClick={openMenu}
        size="small"
        disabled={isRoot}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          disabled={isRoot}
          onClick={() => {
            closeMenu();
            handleRenameDirectory();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={isRoot}
          onClick={() => {
            closeMenu();
            if (directoryId) toggleDirectory(directoryId);
          }}
        >
          <ListItemIcon>
            {isFavourite ? (
              <StarIcon fontSize="small" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {isFavourite ? "Unfavourite" : "Favourite"}
          </ListItemText>
        </MenuItem>
        <MenuItem disabled={isRoot} onClick={openDeleteDialog}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
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
    </>
  );
};

export default DirectoryMenu;
