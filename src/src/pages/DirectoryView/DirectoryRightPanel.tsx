import React, { useState } from "react";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CreateIcon from "@mui/icons-material/Create";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import { Box, Chip, Paper, Stack, styled, Typography } from "@mui/material";
import ArticleIcon from "@mui/icons-material/Article";
import FolderIcon from "@mui/icons-material/Folder";
import type { HirarchyItem } from "../../models/HirarchyItem";
import type { CascadePreview } from "./DirectoryFeatures.hook";
import { PanelButtons } from "../../components/Panels/PanelButtons";
import { UpperPanel } from "../../components/Panels/UpperPanel";
import { PanelSection } from "../../components/Panels/PanelSection";
import { ConfirmationModal } from "../Settings/ConfirmationModal";
import { useFavouritesStore } from "../../zustand/useFavouritesStore";
import { useNavigate, useParams } from "react-router-dom";

export interface DirectoryRightPanelProps {
  currentNode: HirarchyItem;
  cascadePreview: CascadePreview;
  handleCreateNote: () => void;
  handleCreateSubdirectory: () => void;
  handleRenameDirectory: () => void;
  handleDeleteDirectory: () => Promise<boolean>;
}

/**
 * List-item slot for the flex-wrapped notes grid. Mirrors the MUI
 * chips-array pattern: the outer container is a `Paper` with
 * `flexWrap`, and each child sits in a small-margin `li` so the
 * cards distribute evenly across the row.
 */
const NoteCardSlot = styled("li")(({ theme }) => ({
  margin: theme.spacing(0.5),
}));

/**
 * Body of the delete confirmation dialog.
 *
 * Surfaces the cascade impact the user would otherwise miss: how many
 * notes live directly in this directory, how many subdirectories are
 * nested inside (each with its own note count), and the grand total.
 * Renders nothing extra when the directory is empty so empty deletes
 * stay short.
 */
const CascadePreviewMessage: React.FC<{
  directoryName: string;
  preview: CascadePreview;
}> = ({ directoryName, preview }) => {
  const { directNotes, subdirectories, totalSubdirectories, totalNotes } =
    preview;

  const noteWord = (n: number) => (n === 1 ? "note" : "notes");
  const subWord = (n: number) => (n === 1 ? "subdirectory" : "subdirectories");

  // Nothing inside -> keep the message terse. The cascade happens
  // server-side either way, but there is nothing meaningful to list.
  if (totalNotes === 0 && totalSubdirectories === 0) {
    return (
      <Typography variant="body2">
        {directoryName} is empty. Deleting it removes only the directory itself.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {/* Compact "Contents:" header with one outlined chip per
          countable category. Cheaper to scan than a bulleted prose
          list and keeps the dialog narrow when there's little to
          summarize. */}
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Contents:
        </Typography>
        {directNotes.length > 0 && (
          <Chip
            icon={<ArticleIcon />}
            label={`${directNotes.length} ${noteWord(directNotes.length)}`}
            variant="outlined"
            size="small"
          />
        )}
        {totalSubdirectories > 0 && (
          <Chip
            icon={<FolderIcon />}
            label={`${totalSubdirectories} ${subWord(totalSubdirectories)}`}
            variant="outlined"
            size="small"
          />
        )}
      </Stack>

      {directNotes.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Notes in this directory
          </Typography>
          {/* Flex-wrap grid of note cards. Mirrors the MUI chips-array
              pattern: a `Paper component="ul"` with `flexWrap` and a
              per-card `li` so cards distribute across the row and
              wrap to a new line as the dialog widens. */}
          <Paper
            component="ul"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "flex-start",
              listStyle: "none",
              p: 0.5,
              m: 0,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {directNotes.map((note) => (
              <NoteCardSlot key={note.id}>
                <Paper
                  elevation={0}
                  variant="outlined"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    maxWidth: 240,
                  }}
                >
                  <ArticleIcon fontSize="small" sx={{ flexShrink: 0 }} />
                  <Typography
                    variant="body2"
                    noWrap
                    title={note.title}
                    sx={{ minWidth: 0 }}
                  >
                    {note.title}
                  </Typography>
                </Paper>
              </NoteCardSlot>
            ))}
          </Paper>
        </Box>
      )}

      {totalSubdirectories > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Nested subdirectories
          </Typography>
          {/* Single-line hint so the user knows notes inside these
              subdirectories are also deleted without us having to
              enumerate each directory's notes here. */}
          <Typography variant="caption" color="text.secondary">
            All notes inside these subdirectories will also be deleted.
          </Typography>
          {/* Same flex-wrap chip-array layout as the notes grid above. */}
          <Paper
            component="ul"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "flex-start",
              listStyle: "none",
              p: 0.5,
              m: 0,
              mt: 0.5,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {subdirectories.map((dir) => (
              <NoteCardSlot key={dir.getId()}>
                <Paper
                  elevation={0}
                  variant="outlined"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    maxWidth: 240,
                  }}
                >
                  <FolderIcon fontSize="small" sx={{ flexShrink: 0 }} />
                  <Typography
                    variant="body2"
                    noWrap
                    title={dir.getName()}
                    sx={{ minWidth: 0 }}
                  >
                    {dir.getName()}
                  </Typography>
                </Paper>
              </NoteCardSlot>
            ))}
          </Paper>
        </Box>
      )}
    </Stack>
  );
};

/**
 * Right-panel for directory providing actions for it
 */
export const DirectoryRightPanel: React.FC<DirectoryRightPanelProps> = ({
  currentNode,
  cascadePreview,
  handleCreateNote,
  handleCreateSubdirectory,
  handleRenameDirectory,
  handleDeleteDirectory,
}) => {
  const { id: directoryId } = useParams();
  const navigate = useNavigate();
  const isRoot = currentNode.getId() === "root";
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Tracks the in-flight delete so the dialog stays open and the
  // confirm button shows a spinner instead of closing immediately.
  const [deleting, setDeleting] = useState(false);
  // Error from the last delete attempt, surfaced inline in the
  // dialog so the user can retry without re-opening it.
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isFavourite = useFavouritesStore((s) =>
    directoryId ? Boolean(s.directories[directoryId]) : false,
  );
  const toggleDirectory = useFavouritesStore((s) => s.toggleDirectory);

  // Opens the confirmation dialog and clears any stale error from a
  // previous attempt.
  const openDeleteDialog = () => {
    setDeleteError(null);
    setConfirmDeleteOpen(true);
  };

  // Runs the actual delete. Dialog stays open across the await; we
  // only close + navigate on success, and render the error inline
  // on failure.
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
    <UpperPanel>
      <PanelSection title="Actions" showDivider>
        <PanelButtons>
          <PanelButtons.Secondary
            startIcon={<MenuBookIcon />}
            disabled={isRoot}
            onClick={handleRenameDirectory}
          >
            Edit directory
          </PanelButtons.Secondary>
          <PanelButtons.Secondary
            startIcon={<CreateNewFolderIcon />}
            onClick={handleCreateSubdirectory}
          >
            Create subdirectory
          </PanelButtons.Secondary>
          <PanelButtons.Primary
            startIcon={<CreateIcon />}
            onClick={handleCreateNote}
          >
            Create note
          </PanelButtons.Primary>
          <PanelButtons.Secondary
            startIcon={
              isFavourite ? <StarIcon color="primary" /> : <StarBorderIcon />
            }
            disabled={isRoot}
            // `aria-pressed` lets assistive tech announce toggle state.
            aria-pressed={isFavourite}
            onClick={() => directoryId && toggleDirectory(directoryId)}
          >
            {isFavourite ? "Favourited" : "Favourite"}
          </PanelButtons.Secondary>
          <PanelButtons.Secondary
            startIcon={<DeleteIcon />}
            disabled={isRoot}
            color="error"
            onClick={openDeleteDialog}
          >
            Delete directory
          </PanelButtons.Secondary>
        </PanelButtons>
      </PanelSection>
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
          // Cancellation is blocked while the delete is in flight;
          // see ConfirmationModal's `confirming` handling.
          if (!deleting) {
            setConfirmDeleteOpen(false);
          }
        }}
        onConfirm={() => void runDelete()}
      />
    </UpperPanel>
  );
};
