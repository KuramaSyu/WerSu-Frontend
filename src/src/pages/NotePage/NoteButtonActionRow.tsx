import {
  Button,
  Collapse,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import type { Editor } from "@tiptap/core";
import ShareIcon from "@mui/icons-material/Share";
import SaveIcon from "@mui/icons-material/Save";
import { Share } from "@mui/icons-material";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useViewConfig } from "../../zustand/useViewConfig";
import { useState } from "react";
import { ShareDialog } from "./ShareDialog";
import { CollabStatusBadge } from "./CollabStatusBadge";

export const NoteButtonActionRow: React.FC = () => {
  const handleSave = useActiveNoteStore((s) => s.save);
  const { editMode: write, setWrite } = useEditorSettings();
  const readOnly = useViewConfig((s) => s.config.readOnly);
  const { theme } = useThemeStore();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const noteId = useActiveNoteStore((s) => s.noteId);
  const handleChange = (
    event: React.MouseEvent<HTMLElement>,
    newAlignment: string,
  ) => {
    setWrite(newAlignment === "write");
  };

  const control = {
    value: write ? "write" : "read",
    onChange: handleChange,
    exclusive: true,
  };
  return (
    <>
      <Stack
        direction={"column"}
        spacing={theme.spacing(0.5)}
        sx={{ alignItems: "flex-start" }}
      >
        <Stack direction={"row"} spacing={theme.spacing(1)}>
          {/* View-mode controls — toggle + save are hidden when the page
              pins the editor read-only (read-only public shares). The
              share button stays visible: public viewers can copy the URL
              themselves, and it doesn't mutate the note. */}
          {!readOnly && (
            <>
              <ToggleButtonGroup
                size="small"
                {...control}
                aria-label="edit or view mode"
              >
                <ToggleButton value={"read"} key="left">
                  read
                </ToggleButton>

                <ToggleButton value={"write"} key="center">
                  write
                </ToggleButton>
              </ToggleButtonGroup>

              <IconButton onClick={() => void handleSave()}>
                <SaveIcon />
              </IconButton>
            </>
          )}

          <IconButton onClick={() => setShareDialogOpen(true)}>
            <ShareIcon />
          </IconButton>
        </Stack>

        {/* Collab badge — hidden in read mode; the Collapse animation matches
            the editor's `theme.transitions.duration.complex` so it slides in
            without competing with the editor mount. */}
        <Collapse
          in={write}
          timeout={theme.transitions.duration.complex}
          mountOnEnter
          unmountOnExit
        >
          <CollabStatusBadge />
        </Collapse>
      </Stack>
      <ShareDialog
        noteId={noteId ?? ""}
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
      />
    </>
  );
};
