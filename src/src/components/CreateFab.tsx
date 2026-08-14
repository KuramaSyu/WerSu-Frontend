import { useEffect } from "react";
import { Fab, Stack, Typography } from "@mui/material";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import { ShortcutHint } from "./ShortcutHint";
import { isCtrlPlus } from "../utils/CtrlPlus";

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
 *
 * Shortcuts: while this component is mounted, Ctrl+N opens the
 * note dialog and Ctrl+D opens the directory dialog. Both
 * preventDefault so they don't trigger browser "new window"
 * shortcuts. Shortcut hints point `placement="bottom"` because
 * the FABs sit at the bottom-right of the viewport -- a
 * top-anchored popover would visually overlap the button
 * itself instead of clearing it.
 */
const CreateFab: React.FC<CreateFabProps> = ({
  onCreateNote,
  onCreateDirectory,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCtrlPlus(event, "n")) {
        event.preventDefault();
        onCreateNote();
        return;
      }
      if (isCtrlPlus(event, "d")) {
        event.preventDefault();
        onCreateDirectory();
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCreateNote, onCreateDirectory]);

  return (
    <Stack spacing={2} direction="row">
      <ShortcutHint shortcut="ctrl+n" placement="bottom">
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
      </ShortcutHint>
      <ShortcutHint shortcut="ctrl+d" placement="bottom">
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
      </ShortcutHint>
    </Stack>
  );
};

export default CreateFab;
