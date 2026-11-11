import { Stack, ToggleButton, ToggleButtonGroup } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import StrikeThroughIcon from "@mui/icons-material/FormatStrikethrough";
import { useEditorState } from "@tiptap/react";
import { useThemeStore } from "../../../zustand/useThemeStore";
import type { EditorBubbleMenuProps as EditorProps } from "./EditorBubbleMenu";

export const BoldItalicMenu = ({ editor }: EditorProps) => {
  const { isBold, isItalic, isStrikethrough } = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor.isActive("bold"),
      isItalic: ctx.editor.isActive("italic"),
      isStrikethrough: ctx.editor.isActive("strike"),
    }),
  });
  const { theme } = useThemeStore();

  // Derive the highlighted buttons straight from editor state. The
  // ToggleButtons toggle the mark themselves; the group is display-only.
  const formats = [
    ...(isBold ? ["bold"] : []),
    ...(isItalic ? ["italic"] : []),
    ...(isStrikethrough ? ["strike"] : []),
  ];

  return (
    <Stack
      direction="row"
      sx={{ backgroundColor: theme.palette.background.paper }}
    >
      <ToggleButtonGroup
        value={formats}
        aria-label="text formatting"
        color={"secondary"}
      >
        <ToggleButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          value="bold"
          aria-label="bold"
        >
          <FormatBoldIcon />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          value="italic"
          aria-label="italic"
        >
          <FormatItalicIcon />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          value="strike"
          aria-label="strike"
        >
          <StrikeThroughIcon />
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
};
