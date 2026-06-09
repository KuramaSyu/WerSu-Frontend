import {
  Button,
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

export interface NoteButtonActionRowProps {
  handleSave: () => Promise<void>;
  editor: Editor;
  editorMode: "rich" | "source";
  isSaving: boolean;
}

export const NoteButtonActionRow: React.FC<NoteButtonActionRowProps> = ({
  handleSave,
  editor,
  editorMode,
  isSaving,
}) => {
  const { write, setWrite } = useEditorSettings();
  const { theme } = useThemeStore();
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
    <Stack direction={"row"} spacing={theme.spacing(1)}>
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

      <IconButton>
        <ShareIcon />
      </IconButton>
    </Stack>
  );
};
