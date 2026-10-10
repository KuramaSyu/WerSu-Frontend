import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { DOMSerializer } from "prosemirror-model";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
  Divider,
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
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import { CopyButton } from "../CopyButton";
import { copyToClipboard } from "../../zustand/InfoStore";
import { useThemeStore } from "../../zustand/useThemeStore";

// Bubble-menu tooltips: arrow on, anchored above the row so the
// tooltip points back down at the originating icon. Centralising the
// defaults keeps every tooltip in lockstep -- changing the arrow or
// placement in one place updates the whole menu.
const BubbleTooltip = (
  props: Omit<React.ComponentProps<typeof Tooltip>, "arrow" | "placement">,
) => <Tooltip arrow placement="top" {...props} />;

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

// Plain-text dump of the current selection, or "" when collapsed.
function getSelectionText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  if (from === to) return "";
  return editor.state.doc.textBetween(from, to, "\n\n");
}

// HTML dump of the current selection, or "" when collapsed. We
// serialize through ProseMirror's DOMSerializer so node-specific
// markup (extensions like `codeBlock`, images, tables) round-trips
// exactly like the editor renders it.
function getSelectionHtml(editor: Editor): string {
  if (!editor.view) return "";
  const { from, to } = editor.state.selection;
  if (from === to) return "";
  const slice = editor.state.doc.slice(from, to);
  const serializer = DOMSerializer.fromSchema(editor.schema);
  const wrapper = document.createElement("div");
  wrapper.appendChild(serializer.serializeFragment(slice.content));
  return wrapper.innerHTML;
}

// Write `html` (+ `text`) to the clipboard as the rich clipboard
// representation most rich-text targets honour (`text/html` +
// `text/plain` simultaneously). Falls back to plain text via
// `copyToClipboard` when the async Clipboard API is unavailable.
async function writeFormattedClipboard(
  html: string,
  text: string,
): Promise<boolean> {
  if (typeof ClipboardItem === "undefined") {
    return copyToClipboard(text);
  }
  const clipboard = navigator.clipboard;
  if (!clipboard?.write) {
    return copyToClipboard(text);
  }
  try {
    await clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch {
    return copyToClipboard(text);
  }
}

export const TextSelectionBubbleMenu = ({
  editor,
  enabled = true,
}: TextSelectionBubbleMenuProps) => {
  const { theme } = useThemeStore();

  // Formatting flags plus the selection's plain-text payload, which
  // the plain-text copy button seeds from `text` so callers never
  // reach back into `editor.state` at click time.
  const {
    isBold,
    isItalic,
    isStrikethrough,
    isCode,
    isHighlight,
    hasSelection,
    plainSelection,
  } = useEditorState({
    editor,
    selector: (ctx) => {
      const { from, to } = ctx.editor.state.selection;
      return {
        isBold: ctx.editor.isActive("bold"),
        isItalic: ctx.editor.isActive("italic"),
        isStrikethrough: ctx.editor.isActive("strike"),
        isCode: ctx.editor.isActive("code"),
        isHighlight: ctx.editor.isActive("highlight"),
        hasSelection: from !== to,
        plainSelection:
          from !== to ? ctx.editor.state.doc.textBetween(from, to, "\n\n") : "",
      };
    },
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
        easing: isOpen ? ENTER_EASING : theme.transitions.easing.easeOut,
      }),
    [theme, isOpen],
  );
  const transformTransition = useMemo(
    () =>
      theme.transitions.create("transform", {
        duration: isOpen ? ENTER_DURATION_MS : EXIT_DURATION_MS,
        easing: isOpen ? ENTER_EASING : theme.transitions.easing.easeOut,
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

  // `CopyButton` accepts `text` *or* `onCopy`; for the rich copy we
  // skip `text` entirely and drive the clipboard write ourselves so
  // `text/html` lands in the system clipboard (otherwise the html
  // string would only be written as a plain-text blob).
  const copyFormattedSelection = useCallback(async (): Promise<boolean> => {
    const html = getSelectionHtml(editor);
    if (!html) return false;
    return writeFormattedClipboard(html, getSelectionText(editor));
  }, [editor]);

  return (
    <BubbleMenu editor={editor} shouldShow={shouldShow} ref={wrapperRef}>
      <Paper
        elevation={2}
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          // Keep the pill outer -- the rounded silhouette reads as
          // a single floating surface, not a stacked toolbar.
          borderRadius: 50,
          // Trim vertical chrome so the row hugs the selection; the
          // inner Stack supplies the horizontal breathing room.
          py: 1,
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
          divider={
            <Divider
              orientation="vertical"
              flexItem
              sx={{ my: 1, borderColor: theme.palette.divider }}
            />
          }
          spacing={1}
          sx={{
            alignItems: "center",
            px: 1,
            borderRadius: 1,
          }}
        >
          <ToggleButtonGroup
            value={formats}
            size="small"
            color="secondary"
            sx={{
              // Drop the rectangular outline that ToggleButtonGroup
              // draws around itself, plus the per-button borders
              // inside it -- the toggles keep their default corner
              // radius but lose the boxed outline.
              "& .MuiToggleButtonGroup-root": { border: 0 },
              "& .MuiToggleButton-root": { border: 0 },
            }}
          >
            <BubbleTooltip title="Bold">
              <ToggleButton
                value="bold"
                aria-label="Bold"
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <FormatBoldIcon fontSize="small" />
              </ToggleButton>
            </BubbleTooltip>
            <BubbleTooltip title="Italic">
              <ToggleButton
                value="italic"
                aria-label="Italic"
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <FormatItalicIcon fontSize="small" />
              </ToggleButton>
            </BubbleTooltip>
            <BubbleTooltip title="Strikethrough">
              <ToggleButton
                value="strike"
                aria-label="Strikethrough"
                onClick={() => editor.chain().focus().toggleStrike().run()}
              >
                <StrikeThroughIcon fontSize="small" />
              </ToggleButton>
            </BubbleTooltip>
            <BubbleTooltip title="Inline code">
              <ToggleButton
                value="code"
                aria-label="Inline code"
                onClick={() => editor.chain().focus().toggleCode().run()}
              >
                <CodeIcon fontSize="small" />
              </ToggleButton>
            </BubbleTooltip>
            <BubbleTooltip title="Highlight">
              <ToggleButton
                value="highlight"
                aria-label="Highlight"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
              >
                <BorderColorIcon fontSize="small" />
              </ToggleButton>
            </BubbleTooltip>
          </ToggleButtonGroup>

          <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
            <BubbleTooltip title="Copy with formatting">
              <span>
                <CopyButton
                  onCopy={copyFormattedSelection}
                  size="small"
                  aria-label="Copy with formatting"
                  icon={<ContentCopyIcon fontSize="small" />}
                />
              </span>
            </BubbleTooltip>
            <BubbleTooltip title="Copy as plain text">
              <span>
                <CopyButton
                  text={plainSelection}
                  size="small"
                  aria-label="Copy as plain text"
                  icon={<TextSnippetIcon fontSize="small" />}
                />
              </span>
            </BubbleTooltip>
          </Stack>

          <BubbleTooltip title="Clear formatting">
            <ToggleButton
              value="clear-format"
              size="small"
              aria-label="Clear formatting"
              onClick={() =>
                editor.chain().focus().unsetAllMarks().clearNodes().run()
              }
              sx={{ border: 0 }}
            >
              <FormatClearIcon fontSize="small" />
            </ToggleButton>
          </BubbleTooltip>
        </Stack>
      </Paper>
    </BubbleMenu>
  );
};
