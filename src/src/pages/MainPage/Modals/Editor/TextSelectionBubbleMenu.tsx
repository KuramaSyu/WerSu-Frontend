import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect } from "react";
import { Stack, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import StrikeThroughIcon from "@mui/icons-material/FormatStrikethrough";
import CodeIcon from "@mui/icons-material/Code";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import FormatClearIcon from "@mui/icons-material/FormatClear";
import { useThemeStore } from "../../../../zustand/useThemeStore";
import { useEditorMenuStore } from "../../../../zustand/editorMenuStore";

interface TextSelectionBubbleMenuProps {
  editor: Editor;
  enabled?: boolean;
}

const isTextSelectionMenuVisibleNow = (editor: Editor, enabled: boolean) => {
  // Menu is disabled globally or editor is read-only.
  if (!enabled || !editor.isEditable) {
    return false;
  }

  const { from, to, empty } = editor.state.selection;
  // Hide menu for collapsed caret selections.
  if (empty || from === to) {
    return false;
  }

  // Only show when real text is selected (not pure whitespace).
  const selectedText = editor.state.doc.textBetween(from, to).trim();
  return selectedText.length > 0;
};

export const TextSelectionBubbleMenu = ({
  editor,
  enabled = true,
}: TextSelectionBubbleMenuProps) => {
  const { theme } = useThemeStore();
  const setTextSelectionMenuOpen = useEditorMenuStore(
    (state) => state.setTextSelectionMenuOpen,
  );
  const {
    isBold,
    isItalic,
    isStrikethrough,
    isCode,
    isHighlight,
    isTextSelectionMenuVisible,
  } = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor.isActive("bold"),
      isItalic: ctx.editor.isActive("italic"),
      isStrikethrough: ctx.editor.isActive("strike"),
      isCode: ctx.editor.isActive("code"),
      isHighlight: ctx.editor.isActive("highlight"),
      // Keep formatting-state selection and visibility state in one editor snapshot.
      isTextSelectionMenuVisible: isTextSelectionMenuVisibleNow(
        ctx.editor,
        enabled,
      ),
    }),
  });

  useEffect(() => {
    // Publish menu visibility so competing menus (e.g., table controls) can hide immediately.
    setTextSelectionMenuOpen(isTextSelectionMenuVisible);
    return () => {
      // Reset global menu state when component unmounts.
      setTextSelectionMenuOpen(false);
    };
  }, [isTextSelectionMenuVisible, setTextSelectionMenuOpen]);

  useEffect(() => {
    const syncVisibility = () => {
      // Sync immediately on editor events to avoid one-click lag when selection collapses.
      setTextSelectionMenuOpen(isTextSelectionMenuVisibleNow(editor, enabled));
    };

    editor.on("selectionUpdate", syncVisibility);
    editor.on("transaction", syncVisibility);
    editor.on("blur", syncVisibility);
    // Run once on mount/config changes.
    syncVisibility();

    return () => {
      editor.off("selectionUpdate", syncVisibility);
      editor.off("transaction", syncVisibility);
      editor.off("blur", syncVisibility);
    };
  }, [editor, enabled, setTextSelectionMenuOpen]);

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
      // Read live editor state so menu closes immediately when selection collapses.
      shouldShow={() => isTextSelectionMenuVisibleNow(editor, enabled)}
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
