import { Box, Fab } from "@mui/material";
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
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
    <Fab color="primary" aria-label="New note" onClick={onCreateNote}>
      <NoteAddIcon />
    </Fab>
    <Fab color="default" aria-label="New directory" onClick={onCreateDirectory}>
      <CreateNewFolderIcon />
    </Fab>
  </Box>
);

export default CreateFab;
