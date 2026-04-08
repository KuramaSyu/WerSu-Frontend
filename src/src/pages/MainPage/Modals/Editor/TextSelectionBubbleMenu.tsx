import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Stack, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import StrikeThroughIcon from "@mui/icons-material/FormatStrikethrough";
import CodeIcon from "@mui/icons-material/Code";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import FormatClearIcon from "@mui/icons-material/FormatClear";
import { useThemeStore } from "../../../../zustand/useThemeStore";

interface TextSelectionBubbleMenuProps {
  editor: Editor;
  enabled?: boolean;
}

export const TextSelectionBubbleMenu = ({
  editor,
  enabled = true,
}: TextSelectionBubbleMenuProps) => {
  const { theme } = useThemeStore();
  const { isBold, isItalic, isStrikethrough, isCode, isHighlight } =
    useEditorState({
      editor,
      selector: (ctx) => ({
        isBold: ctx.editor.isActive("bold"),
        isItalic: ctx.editor.isActive("italic"),
        isStrikethrough: ctx.editor.isActive("strike"),
        isCode: ctx.editor.isActive("code"),
        isHighlight: ctx.editor.isActive("highlight"),
      }),
    });

  const formats = [
    ...(isBold ? ["bold"] : []),
    ...(isItalic ? ["italic"] : []),
    ...(isStrikethrough ? ["strike"] : []),
    ...(isCode ? ["code"] : []),
    ...(isHighlight ? ["highlight"] : []),
  ];

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8, flip: true }}
      shouldShow={({ editor: activeEditor, from, to }) => {
        if (!enabled || !activeEditor.isEditable) {
          return false;
        }

        if (from === to) {
          return false;
        }

        const selectedText = activeEditor.state.doc
          .textBetween(from, to)
          .trim();
        return selectedText.length > 0;
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{
          p: 0.5,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <ToggleButtonGroup value={formats} size="small" color="secondary">
          <ToggleButton
            value="bold"
            aria-label="bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <FormatBoldIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="italic"
            aria-label="italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <FormatItalicIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="strike"
            aria-label="strike"
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <StrikeThroughIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="code"
            aria-label="code"
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <CodeIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="highlight"
            aria-label="highlight"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            <BorderColorIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        <Tooltip title="Clear formatting">
          <ToggleButton
            value="clear-format"
            size="small"
            aria-label="clear formatting"
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            <FormatClearIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </Stack>
    </BubbleMenu>
  );
};
