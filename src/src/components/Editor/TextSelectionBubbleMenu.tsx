import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
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

// Symmetric enter/exit values used by the sx-prop transition. Enter
// uses a slight overshoot so the menu pops in; exit uses a clean
// ease-out so it does not bounce on the way out.
const ENTER_DURATION_MS = 240;
const ENTER_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const EXIT_DURATION_MS = 160;

// The Tiptap BubbleMenu plugin writes `left`/`top` directly on its
// wrapper `<div>` (the portal target). With a CSS transition applied
// to that wrapper, position updates between selection rects slide
// smoothly instead of jumping.
const MOVE_DURATION_MS = 180;

export const TextSelectionBubbleMenu = ({
  editor,
  enabled = true,
}: TextSelectionBubbleMenuProps) => {
  const { theme } = useThemeStore();

  // Formatting flags only; visibility lives below.
  const { isBold, isItalic, isStrikethrough, isCode, isHighlight, hasSelection } =
    useEditorState({
      editor,
      selector: (ctx) => ({
        isBold: ctx.editor.isActive("bold"),
        isItalic: ctx.editor.isActive("italic"),
        isStrikethrough: ctx.editor.isActive("strike"),
        isCode: ctx.editor.isActive("code"),
        isHighlight: ctx.editor.isActive("highlight"),
        hasSelection: !ctx.editor.state.selection.empty,
      }),
    });

  // Always-mounted: keep the wrapper in the DOM while the editor is
  // editable so we can drive opacity / transform ourselves and let
  // the exit transition play to completion.
  const shouldShow = useCallback(
    ({ editor: viewEditor }: { editor: Editor }) =>
      enabled && viewEditor.isEditable,
    [enabled],
  );

  const isOpen = enabled && editor.isEditable && hasSelection;

  // Forward the plugin's `<div>` wrapper so we can attach the
  // position transition directly to it -- that is the element the
  // floating-ui plugin writes `left`/`top` to on every selection
  // change.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.style.transition = [
      `left ${MOVE_DURATION_MS}ms ease-out`,
      `top ${MOVE_DURATION_MS}ms ease-out`,
    ].join(", ");
    return () => {
      el.style.transition = "";
    };
  }, [isOpen]);

  const opacityTransition = useMemo(
    () =>
      theme.transitions.create("opacity", {
        duration: isOpen ? ENTER_DURATION_MS : EXIT_DURATION_MS,
        easing: isOpen
          ? ENTER_EASING
          : theme.transitions.easing.easeOut,
      }),
    [theme, isOpen],
  );
  const transformTransition = useMemo(
    () =>
      theme.transitions.create("transform", {
        duration: isOpen ? ENTER_DURATION_MS : EXIT_DURATION_MS,
        easing: isOpen
          ? ENTER_EASING
          : theme.transitions.easing.easeOut,
      }),
    [theme, isOpen],
  );

  const formats = [
    ...(isBold ? ["bold"] : []),
    ...(isItalic ? ["italic"] : []),
    ...(isStrikethrough ? ["strike"] : []),
    ...(isCode ? ["code"] : []),
    ...(isHighlight ? ["highlight"] : []),
  ];

  return (
    <BubbleMenu editor={editor} shouldShow={shouldShow} ref={wrapperRef}>
      <Paper
        elevation={2}
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 50,
          p: 1,
          opacity: isOpen ? 1 : 0,
          transform: isOpen
            ? "translateY(0) scale(1)"
            : "translateY(-8px) scale(0.94)",
          transformOrigin: "center",
          transition: [opacityTransition, transformTransition].join(", "),
          pointerEvents: isOpen ? "auto" : "none",
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

