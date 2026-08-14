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
 * Shortcuts: while this component is mounted, Ctrl+Alt+N opens
 * the note dialog and Ctrl+Alt+D opens the directory dialog.
 * The combo is Ctrl+Alt (not plain Ctrl) because plain Ctrl+N is
 * hard-wired to Firefox's "new window" command and Ctrl+D to
 * "bookmark this page" -- `preventDefault()` cannot suppress
 * either reliably across builds. Adding Alt to the binding puts
 * the shortcut outside the browser's reserved combos, so the
 * keybinding belongs to us alone.
 *
 * Shortcut hints point `placement="bottom"` because the FABs sit
 * at the bottom-right of the viewport -- a top-anchored popover
 * would visually overlap the button itself instead of clearing
 * it.
 */
const CreateFab: React.FC<CreateFabProps> = ({
  onCreateNote,
  onCreateDirectory,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCtrlPlus(event, "n", { alt: true })) {
        event.preventDefault();
        onCreateNote();
        return;
      }
      if (isCtrlPlus(event, "d", { alt: true })) {
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
      <ShortcutHint shortcut="ctrl+alt+n" placement="bottom">
        <Fab
          color="primary"
          aria-label="New note"
          onClick={onCreateNote}
          variant="extended"
          size="medium"
          sx={{
            borderRadius: 6,
            ":hover": {
              borderRadius: 6,
            },
          }}
        >
          <NoteAddIcon sx={{ mr: 1 }} />
          <Typography>Note</Typography>
        </Fab>
      </ShortcutHint>
      <ShortcutHint shortcut="ctrl+alt+d" placement="bottom">
        <Fab
          color="primary"
          aria-label="New directory"
          onClick={onCreateDirectory}
          variant="extended"
          size="medium"
          sx={{
            borderRadius: 6,
            ":hover": {
              borderRadius: 6,
            },
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
