import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { DOMSerializer } from "prosemirror-model";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
  Divider,
  Grow,
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
import {
  analyseSelection,
  pickStrategy,
  type BubbleMenuOp,
} from "./bubbleMenuStrategies";

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

  // Track whether the user is mid-drag. Read directly from the
  // store (not via useSyncExternalStore) so this component
  // re-renders on pointer state changes; the bridge updates
  // the store on every pointerdown/pointerup.
  const isPointerDown = useEditorMenuStore((s) => s.isPointerDown);

  // The active marks and the plain-text payload. The plain-text
  // copy button seeds from `text` so callers never reach back
  // into `editor.state` at click time.
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

  // Pick the right strategy. Re-evaluates on every selection
  // change because `useEditorState` triggers a re-render of
  // subscribers when its selector output changes -- the analysis
  // output is a fresh object, so reference changes always. The
  // strategy itself is cheap; running it here keeps the
  // component declarative.
  const analysis = useEditorState({
    editor,
    selector: (ctx) => analyseSelection(ctx.editor.state),
  });
  const strategy = pickStrategy(analysis);
  const ops = useMemo(
    () => strategy.build(analysis, editor),
    [strategy, analysis, editor],
  );

  // Always-mounted: keep the wrapper in the DOM while the editor
  // is editable so we can drive opacity / transform ourselves
  // and let the exit transition play to completion.
  const shouldShow = useCallback(
    ({ editor: viewEditor }: { editor: Editor }) =>
      enabled && viewEditor.isEditable,
    [enabled],
  );

  // The menu only shows after the user has released the mouse.
  // `hasSelection` keeps the menu out of the way when the
  // selection is collapsed. `editor.isEditable` short-circuits
  // the same condition the `shouldShow` callback uses, so the
  // plugin's mount state and our opacity state stay in sync.
  const isOpen = enabled && editor.isEditable && hasSelection && !isPointerDown;

  // Forward the plugin's `<div>` wrapper so we can attach the
  // position transition directly to it -- that is the element
  // the floating-ui plugin writes `left`/`top` to on every
  // selection change.
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

  // The format toggles: bold / italic / strike / code / highlight.
  // Active marks are reflected as `value` entries so the group
  // renders them as depressed. Only rendered when the text
  // formatting ops are present in the strategy output.
  const formats = [
    ...(isBold ? ["bold"] : []),
    ...(isItalic ? ["italic"] : []),
    ...(isStrikethrough ? ["strike"] : []),
    ...(isCode ? ["code"] : []),
    ...(isHighlight ? ["highlight"] : []),
  ];

  // `CopyButton` accepts `text` *or* `onCopy`; for the rich copy
  // we skip `text` entirely and drive the clipboard write
  // ourselves so `text/html` lands in the system clipboard
  // (otherwise the html string would only be written as a
  // plain-text blob).
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
          // Trim vertical chrome so the row hugs the selection;
          // the inner Stack supplies the horizontal breathing
          // room.
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
          {renderOps(ops, {
            editor,
            formats,
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

/** Map the strategy's op list to React nodes. Splitting this
 *  out keeps the main component focused on visibility / styling;
 *  the rendering rules per op kind live here.
 *
 *  `key` includes the strategy name so a strategy switch (e.g.
 *  row -> column) unmounts the old buttons and remounts fresh
 *  ones; combined with `<Grow appear>`, the new row slides in
 *  instead of swapping in place. */
function renderOps(
  ops: readonly BubbleMenuOp[],
  ctx: {
    editor: Editor;
    formats: string[];
    copyFormattedSelection: () => Promise<boolean>;
    plainSelection: string;
    strategyName: string;
    isOpen: boolean;
  },
): React.ReactNode {
  const {
    editor,
    formats,
    copyFormattedSelection,
    plainSelection,
    strategyName,
    isOpen,
  } = ctx;
  const out: React.ReactNode[] = [];

  // The legacy menu had two copy buttons (formatted + plain)
  // plus the toggles + the clear-format action. Show them
  // whenever any toggle is rendered (which is true for every
  // strategy except `table-whole`).
  const hasToggle = ops.some((o) => o.kind === "toggle");

  ops.forEach((op, index) => {
    const key = `${strategyName}:${opKey(op, index)}`;
    if (op.kind === "divider") {
      return;
    }
    if (op.kind === "toggle") {
      out.push(
        <Grow
          key={key}
          in={isOpen}
          appear
          style={{
            transformOrigin: "center",
            transitionDelay: `${index * 18}ms`,
          }}
        >
          <ToggleButtonGroup
            value={formats}
            size="small"
            color="secondary"
            sx={{
              "& .MuiToggleButtonGroup-root": { border: 0 },
              "& .MuiToggleButton-root": { border: 0 },
            }}
          >
            <BubbleTooltip title={op.label}>
              <ToggleButton
                value={op.mark}
                aria-label={op.label}
                onClick={() => toggleMark(editor, op.mark)}
              >
                {iconForMark(op.mark)}
              </ToggleButton>
            </BubbleTooltip>
          </ToggleButtonGroup>
        </Grow>,
      );
      return;
    }
    if (op.kind === "copy") {
      const onCopy = op.mode === "html" ? copyFormattedSelection : undefined;
      const text = op.mode === "html" ? undefined : op.text || plainSelection;
      out.push(
        <BubbleTooltip key={key} title={op.label}>
          <span>
            <CopyButton
              {...(onCopy ? { onCopy } : {})}
              {...(text !== undefined ? { text } : {})}
              size="small"
              aria-label={op.label}
              icon={iconForName(op.icon)}
            />
          </span>
        </BubbleTooltip>,
      );
      return;
    }
    if (op.kind === "action") {
      out.push(
        <Grow
          key={key}
          in={isOpen}
          appear
          style={{
            transformOrigin: "center",
            transitionDelay: `${index * 24}ms`,
          }}
        >
          <BubbleTooltip title={op.label}>
            <ToggleButton
              value={op.id}
              size="small"
              aria-label={op.label}
              onClick={() => op.run(editor)}
              sx={{ border: 0 }}
            >
              {iconForName(op.icon)}
            </ToggleButton>
          </BubbleTooltip>
        </Grow>,
      );
      return;
    }
  });

  if (hasToggle) {
    out.push(
      <Grow
        key={`${strategyName}:legacy-copy`}
        in={isOpen}
        appear
        style={{ transformOrigin: "center", transitionDelay: "120ms" }}
      >
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
      </Grow>,
    );
  }

  return out;
}

function opKey(op: BubbleMenuOp, index: number): string {
  switch (op.kind) {
    case "divider":
      return `divider-${index}`;
    case "toggle":
      return `toggle-${op.mark}`;
    case "action":
      return `action-${op.id}`;
    case "copy":
      return `copy-${op.mode}`;
  }
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
    default:
      // Unknown mark: ignore. Adding a new mark requires
      // updating this function.
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

/** Resolve a strategy's `icon` name to an icon component.
 *  Material icons cover the text-formatting ops; Tabler icons
 *  cover the table ops. The strategy layer only knows strings
 *  so it can stay presentation-agnostic; the mapping lives
 *  here. */
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
    // Row ops -- Tabler icons.
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
    // Column ops -- Tabler icons.
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
    // Whole-table op.
    case "table-remove":
      return <IconTableOff size={18} />;
    // Unknown -- fall through to a neutral icon so a typo in
    // the strategy never silently renders nothing.
    default:
      return <FormatClearIcon fontSize="small" />;
  }
}
