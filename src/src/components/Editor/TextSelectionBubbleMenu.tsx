import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useCallback } from "react";
import {
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import StrikeThroughIcon from "@mui/icons-material/FormatStrikethrough";
import CodeIcon from "@mui/icons-material/Code";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import FormatClearIcon from "@mui/icons-material/FormatClear";
import { useThemeStore } from "../../zustand/useThemeStore";

interface TextSelectionBubbleMenuProps {
  editor: Editor;
  enabled?: boolean;
}

// O(1) shouldShow. Must stay cheap: invoked on every transaction.
const isTextSelectionMenuVisibleNow = (editor: Editor, enabled: boolean) => {
  if (!enabled || !editor.isEditable) return false;
  if (!editor.isFocused) return false;
  const { from, to, empty } = editor.state.selection;
  if (empty || from === to) return false;
  return true;
};

export const TextSelectionBubbleMenu = ({
  editor,
  enabled = true,
}: TextSelectionBubbleMenuProps) => {
  const { theme } = useThemeStore();

  // Formatting flags only; visibility lives in MenuVisibilityBridge.
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

  // Stable identity so the BubbleMenu plugin doesn't tear down on every render.
  const shouldShow = useCallback(
    ({ editor: viewEditor }: { editor: Editor }) =>
      isTextSelectionMenuVisibleNow(viewEditor, enabled),
    [enabled],
  );

  const formats = [
    ...(isBold ? ["bold"] : []),
    ...(isItalic ? ["italic"] : []),
    ...(isStrikethrough ? ["strike"] : []),
    ...(isCode ? ["code"] : []),
    ...(isHighlight ? ["highlight"] : []),
  ];

  return (
    <BubbleMenu editor={editor} shouldShow={shouldShow}>
      <Paper
        elevation={2}
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 50,
          p: 1,
        }}
      >
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            alignItems: "center",
            borderRadius: 1,
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
      </Paper>
    </BubbleMenu>
  );
};
