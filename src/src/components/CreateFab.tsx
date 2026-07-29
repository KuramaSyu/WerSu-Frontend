import { Box, Fab, Stack, Tooltip, Typography } from "@mui/material";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import NoteAddIcon from "@mui/icons-material/NoteAdd";

export interface CreateFabProps {
  onCreateNote: () => void;
  onCreateDirectory: () => void;
}

/**
 * Stacked floating action buttons for the two "create" actions.
 *
 * Renders a primary FAB (new note) and a secondary FAB (new
 * directory) in a vertical column. The host page owns positioning -
 * this component does not set its own fixed position so callers can
 * drop it into an existing layout container without conflicting
 * `position: fixed` rules.
 */
const CreateFab: React.FC<CreateFabProps> = ({
  onCreateNote,
  onCreateDirectory,
}) => (
  <Stack spacing={2} direction="row">
    <Tooltip title="Create new note" placement="top" arrow>
      <Fab
        color="primary"
        aria-label="New note"
        onClick={onCreateNote}
        variant="extended"
        size="medium"
        sx={{
          borderRadius: 6,
        }}
      >
        <NoteAddIcon sx={{ mr: 1 }} />
        <Typography>Note</Typography>
      </Fab>
    </Tooltip>
    <Tooltip title="Create new directory" placement="top" arrow>
      <Fab
        color="primary"
        aria-label="New directory"
        onClick={onCreateDirectory}
        variant="extended"
        size="medium"
        sx={{
          borderRadius: 6,
        }}
      >
        <CreateNewFolderIcon sx={{ mr: 1 }} />
        <Typography>Folder</Typography>
      </Fab>
    </Tooltip>
  </Stack>
);

export default CreateFab;
