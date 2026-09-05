import { useEffect } from "react";
import { Fab, Stack, Typography } from "@mui/material";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import { ShortcutHint } from "./ShortcutHint";
import { isCtrlPlus } from "../utils/CtrlPlus";

export interface CreateFabProps {
  onCreateNote: () => void;
  /**
   * When omitted, the directory FAB isn't rendered. Pages that
   * don't expose a "create directory" affordance (e.g. the
   * all-notes landing) only pass `onCreateNote`.
   */
  onCreateDirectory?: () => void;
}

/**
 * Stacked floating action buttons for the two "create" actions.
 *
 * Renders a primary FAB (new note) and a secondary FAB (new
 * directory) in a vertical column.
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
        if (onCreateDirectory) {
          event.preventDefault();
          onCreateDirectory();
        }
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
      {onCreateDirectory && (
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
      )}
    </Stack>
  );
};

export default CreateFab;
