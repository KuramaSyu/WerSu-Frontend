import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { DOMSerializer } from "prosemirror-model";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
  Divider,
  Grow,
  IconButton,
  Paper,
  Stack,
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
import { useEditorMenuStore } from "../../zustand/editorMenuStore";
import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconRowInsertTop,
  IconRowInsertBottom,
  IconRowRemove,
  IconTableOff,
  IconTransitionBottom,
  IconTransitionLeft,
  IconTransitionRight,
  IconTransitionTop,
} from "@tabler/icons-react";
import { analyseSelection, pickStrategy } from "./bubbleMenuStrategies";

// Shared tooltip defaults: arrow on, anchored above.
const BubbleTooltip = (
  props: Omit<React.ComponentProps<typeof Tooltip>, "arrow" | "placement">,
) => <Tooltip arrow placement="top" {...props} />;

// Stagger between sibling icons on enter.
const ICON_DELAY_MS = 12;
// Enter easing has a slight overshoot so the menu pops in.
const ENTER_DURATION_MS = 240;
const ENTER_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const EXIT_DURATION_MS = 160;
// Slide the menu between selection rects instead of jumping.
const MOVE_DURATION_MS = 180;

interface TextSelectionBubbleMenuProps {
  editor: Editor;
  enabled?: boolean;
}

// Plain-text dump of the current selection, or empty when collapsed.
function getSelectionText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  if (from === to) return "";
  return editor.state.doc.textBetween(from, to, "\n\n");
}

// HTML dump of the current selection, or empty when collapsed.
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

// Write html and text to the clipboard; falls back to plain text only.
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

  // Subscribe so the menu reactively collapses while the pointer is down.
  const isPointerDown = useEditorMenuStore((s) => s.isPointerDown);

  const { activeMarks, hasSelection, plainSelection } = useEditorState({
    editor,
    selector: (ctx) => {
      const { from, to } = ctx.editor.state.selection;
      return {
        activeMarks: {
          bold: ctx.editor.isActive("bold"),
          italic: ctx.editor.isActive("italic"),
          strike: ctx.editor.isActive("strike"),
          code: ctx.editor.isActive("code"),
          highlight: ctx.editor.isActive("highlight"),
        },
        hasSelection: from !== to,
        plainSelection:
          from !== to
            ? ctx.editor.state.doc.textBetween(from, to, "\n\n")
            : "",
      };
    },
  });

  // Pick the right strategy for the current selection shape.
  const analysis = useEditorState({
    editor,
    selector: (ctx) => analyseSelection(ctx.editor.state),
  });
  const strategy = pickStrategy(analysis);
  const ops = useMemo(
    () => strategy.build(analysis, editor),
    [strategy, analysis, editor],
  );

  // Keep the wrapper mounted so opacity and transform can animate both ways.
  const shouldShow = useCallback(
    ({ editor: viewEditor }: { editor: Editor }) =>
      enabled && viewEditor.isEditable,
    [enabled],
  );

  // Menu only opens after the user releases the pointer over a real selection.
  const isOpen =
    enabled && editor.isEditable && hasSelection && !isPointerDown;

  // Forward the plugin wrapper so we can drive its position transition.
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

  // Drive the clipboard write ourselves so the html blob reaches the clipboard.
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
          // Pill silhouette so the surface reads as one floating chip.
          borderRadius: 50,
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
          spacing={1}
          sx={{ alignItems: "center", px: 1, borderRadius: 1 }}
        >
          {renderOps(ops, {
            editor,
            activeMarks,
            copyFormattedSelection,
            plainSelection,
            strategyName: strategy.name,
            isOpen,
          })}
        </Stack>
      </Paper>
    </BubbleMenu>
  );
};

// Section each strategy op belongs to in the flat row.
type Section = "table" | "normal" | "copy";
function sectionOf(op: { kind: string; group?: string }): Section {
  if (op.kind === "action" && op.group === "table") return "table";
  if (op.kind === "copy") return "copy";
  return "normal";
}

// Render ops as a flat stack: one button per item, dividers only at section changes.
function renderOps(
  ops: readonly import("./bubbleMenuStrategies").BubbleMenuOp[],
  ctx: {
    editor: Editor;
    activeMarks: Record<string, boolean>;
    copyFormattedSelection: () => Promise<boolean>;
    plainSelection: string;
    strategyName: string;
    isOpen: boolean;
  },
): React.ReactNode {
  const { theme } = useThemeStore.getState();
  const out: React.ReactNode[] = [];
  let index = 0;
  let lastSection: Section | null = null;

  const pushDivider = () =>
    out.push(
      <Divider
        key={`${ctx.strategyName}:divider:${out.length}`}
        orientation="vertical"
        flexItem
        sx={{ my: 1, borderColor: theme.palette.divider }}
      />,
    );

  // Per-button entrance stagger shared across the whole menu.
  const delayStyle = (): React.CSSProperties => ({
    transformOrigin: "center",
    transitionDelay: `${index++ * ICON_DELAY_MS}ms`,
  });

  const flushSection = (next: Section) => {
    if (lastSection !== null && lastSection !== next) pushDivider();
    lastSection = next;
  };

  ops.forEach((op) => {
    flushSection(sectionOf(op));

    if (op.kind === "toggle") {
      const isActive = !!ctx.activeMarks[op.mark];
      out.push(
        <Grow
          key={`${ctx.strategyName}:toggle-${op.mark}`}
          in={ctx.isOpen}
          appear
          style={delayStyle()}
        >
          <BubbleTooltip title={op.label}>
            <IconButton
              size="small"
              aria-label={op.label}
              color={isActive ? "secondary" : "default"}
              onClick={() => toggleMark(ctx.editor, op.mark)}
            >
              {iconForMark(op.mark)}
            </IconButton>
          </BubbleTooltip>
        </Grow>,
      );
      return;
    }

    if (op.kind === "action") {
      const paletteKey = actionPaletteKey(op.id);
      out.push(
        <Grow
          key={`${ctx.strategyName}:action-${op.id}`}
          in={ctx.isOpen}
          appear
          style={delayStyle()}
        >
          <BubbleTooltip title={op.label}>
            <IconButton
              size="small"
              aria-label={op.label}
              onClick={() => op.run(ctx.editor)}
              sx={paletteKey ? { color: `${paletteKey}.main` } : undefined}
            >
              {iconForName(op.icon)}
            </IconButton>
          </BubbleTooltip>
        </Grow>,
      );
      return;
    }

    if (op.kind === "copy") {
      const onCopy =
        op.mode === "html" ? ctx.copyFormattedSelection : undefined;
      const text =
        op.mode === "html" ? undefined : op.text || ctx.plainSelection;
      out.push(
        <Grow
          key={`${ctx.strategyName}:copy-${op.mode}`}
          in={ctx.isOpen}
          appear
          style={delayStyle()}
        >
          <BubbleTooltip title={op.label}>
            <span>
              <CopyButton
                {...(onCopy ? { onCopy } : {})}
                {...(text !== undefined ? { text } : {})}
                size="small"
                aria-label={op.label}
                icon={iconForName(op.icon)}
              />
            </span>
          </BubbleTooltip>
        </Grow>,
      );
    }
  });

  // Legacy copy row: two plain copy buttons when the strategy has toggles.
  const hasToggle = ops.some((o) => o.kind === "toggle");
  if (hasToggle) {
    flushSection("copy");
    out.push(
      <Grow
        key={`${ctx.strategyName}:copy-format`}
        in={ctx.isOpen}
        appear
        style={delayStyle()}
      >
        <BubbleTooltip title="Copy with formatting">
          <span>
            <CopyButton
              onCopy={ctx.copyFormattedSelection}
              size="small"
              aria-label="Copy with formatting"
              icon={<ContentCopyIcon fontSize="small" />}
            />
          </span>
        </BubbleTooltip>
      </Grow>,
    );
    out.push(
      <Grow
        key={`${ctx.strategyName}:copy-plain`}
        in={ctx.isOpen}
        appear
        style={delayStyle()}
      >
        <BubbleTooltip title="Copy as plain text">
          <span>
            <CopyButton
              text={ctx.plainSelection}
              size="small"
              aria-label="Copy as plain text"
              icon={<TextSnippetIcon fontSize="small" />}
            />
          </span>
        </BubbleTooltip>
      </Grow>,
    );
  }

  return out;
}

// add-* tints primary, delete-* tints error, otherwise neutral.
function actionPaletteKey(id: string): "primary" | "error" | null {
  if (id.startsWith("add-")) return "primary";
  if (id.startsWith("delete-")) return "error";
  return null;
}

function toggleMark(editor: Editor, mark: string): void {
  const chain = editor.chain().focus();
  switch (mark) {
    case "bold":
      chain.toggleBold().run();
      return;
    case "italic":
      chain.toggleItalic().run();
      return;
    case "strike":
      chain.toggleStrike().run();
      return;
    case "code":
      chain.toggleCode().run();
      return;
    case "highlight":
      chain.toggleHighlight().run();
      return;
  }
}

function iconForMark(mark: string): React.ReactNode {
  switch (mark) {
    case "bold":
      return <FormatBoldIcon fontSize="small" />;
    case "italic":
      return <FormatItalicIcon fontSize="small" />;
    case "strike":
      return <StrikeThroughIcon fontSize="small" />;
    case "code":
      return <CodeIcon fontSize="small" />;
    case "highlight":
      return <BorderColorIcon fontSize="small" />;
    default:
      return null;
  }
}

// Resolve a strategy icon name to a component.
function iconForName(name: string): React.ReactNode {
  switch (name) {
    case "format-bold":
      return <FormatBoldIcon fontSize="small" />;
    case "format-italic":
      return <FormatItalicIcon fontSize="small" />;
    case "format-strikethrough":
      return <StrikeThroughIcon fontSize="small" />;
    case "format-clear":
      return <FormatClearIcon fontSize="small" />;
    case "code":
      return <CodeIcon fontSize="small" />;
    case "highlight":
      return <BorderColorIcon fontSize="small" />;
    case "row-insert-top":
      return <IconRowInsertTop size={18} />;
    case "row-insert-bottom":
      return <IconRowInsertBottom size={18} />;
    case "row-remove":
      return <IconRowRemove size={18} />;
    case "row-move-up":
      return <IconTransitionTop size={18} />;
    case "row-move-down":
      return <IconTransitionBottom size={18} />;
    case "column-insert-left":
      return <IconColumnInsertLeft size={18} />;
    case "column-insert-right":
      return <IconColumnInsertRight size={18} />;
    case "column-remove":
      return <IconColumnRemove size={18} />;
    case "column-move-left":
      return <IconTransitionLeft size={18} />;
    case "column-move-right":
      return <IconTransitionRight size={18} />;
    case "table-remove":
      return <IconTableOff size={18} />;
    // Typo fallback renders a neutral icon instead of nothing.
    default:
      return <FormatClearIcon fontSize="small" />;
  }
}
