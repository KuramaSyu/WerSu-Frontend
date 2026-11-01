// ---------------------------------------------------------------------------
// NoteSourceEditor
// Source-mode TextField. Uses forwardRef so the page body can read
// the underlying textarea selection. Memoized: per-keystroke edits
// only re-render this surface.
//
// A plain auto-growing textarea cannot render match highlights, so the
// find widget publishes its source matches to `useNoteFindStore` and
// this component paints them in a mirrored overlay behind a
// transparent-text textarea. The active hit is scrolled into view.
// ---------------------------------------------------------------------------

import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Box, TextField } from "@mui/material";
import { logRerender } from "./editorRenderLog";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useNoteFindStore } from "../../zustand/useNoteFindStore";

export interface NoteSourceEditorProps {
  sourceMarkdown: string;
  setSourceMarkdown: (markdown: string) => void;
  editorWidth: number | string;
}

export interface NoteSourceEditorHandle {
  /** Read the current selection range of the underlying textarea. */
  getSelectionRange: () => { start: number; end: number } | null;
}

// Shared text metrics for the textarea and its mirror. Keeping these in
// one object is what makes the two layers line up exactly.
const TEXT_METRICS: CSSProperties = {
  fontFamily: "monospace",
  fontSize: "1rem",
  lineHeight: 1.5,
  letterSpacing: "normal",
  tabSize: 4,
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  wordBreak: "break-word",
  padding: "16.5px 14px",
  boxSizing: "border-box",
};

const MATCH_STYLE: CSSProperties = {
  backgroundColor: "rgba(250, 204, 21, 0.35)",
  color: "inherit",
  borderRadius: 2,
  boxShadow: "0 0 0 1px rgba(250, 204, 21, 0.5)",
};

const ACTIVE_MATCH_STYLE: CSSProperties = {
  backgroundColor: "rgba(249, 115, 22, 0.55)",
  color: "inherit",
  borderRadius: 2,
  boxShadow: "0 0 0 1px rgba(249, 115, 22, 0.9)",
};

const NoteSourceEditorImpl = forwardRef<
  NoteSourceEditorHandle,
  NoteSourceEditorProps
>(({ sourceMarkdown, setSourceMarkdown, editorWidth }, ref) => {
  logRerender("NoteSourceEditor", { sourceLen: sourceMarkdown.length });
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null);
  const editMode = useEditorSettings((s) => s.editMode);
  const { theme } = useThemeStore();
  const matches = useNoteFindStore((s) => s.matches);
  const activeIndex = useNoteFindStore((s) => s.activeIndex);
  const activeMarkRef = useRef<HTMLElement | null>(null);

  const hasHighlight = matches.length > 0;

  useImperativeHandle(
    ref,
    () => ({
      getSelectionRange: () => {
        if (!textarea) return null;
        return {
          start: textarea.selectionStart,
          end: textarea.selectionEnd,
        };
      },
    }),
    [textarea],
  );

  const highlighted = useMemo(() => {
    if (!hasHighlight) return null;
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    matches.forEach((match, index) => {
      const from = Math.max(0, Math.min(match.from, sourceMarkdown.length));
      const to = Math.max(from, Math.min(match.to, sourceMarkdown.length));
      if (from > cursor) {
        nodes.push(sourceMarkdown.slice(cursor, from));
      }
      nodes.push(
        <mark
          key={`${from}-${to}-${index}`}
          ref={index === activeIndex ? activeMarkRef : undefined}
          style={index === activeIndex ? ACTIVE_MATCH_STYLE : MATCH_STYLE}
        >
          {sourceMarkdown.slice(from, to)}
        </mark>,
      );
      cursor = to;
    });
    if (cursor < sourceMarkdown.length) {
      nodes.push(sourceMarkdown.slice(cursor));
    }
    return nodes;
  }, [activeIndex, hasHighlight, matches, sourceMarkdown]);

  // Move the viewport to the active hit. `block: "center"` works for
  // both the page scroll and an internally scrollable textarea.
  useEffect(() => {
    activeMarkRef.current?.scrollIntoView({
      block: "center",
      inline: "nearest",
    });
  }, [activeIndex, matches]);

  return (
    <Box
      sx={{
        width: editorWidth,
        mx: "auto",
        position: "relative",
        transition: (t) =>
          t.transitions.create("width", {
            duration: t.transitions.duration.complex,
          }),
      }}
    >
      {hasHighlight && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            // No overflow clipping: `overflow: hidden` would make this
            // layer a scroll container and stop `scrollIntoView` from
            // walking up to the real page scroller.
            overflow: "visible",
            pointerEvents: "none",
            color: theme.palette.text.primary,
            ...TEXT_METRICS,
          }}
        >
          {highlighted}
        </Box>
      )}
      <TextField
        value={sourceMarkdown}
        onChange={(event) => setSourceMarkdown(event.target.value)}
        multiline
        minRows={16}
        placeholder="Markdown source"
        fullWidth
        inputRef={setTextarea}
        disabled={!editMode}
        sx={{
          fontFamily: "monospace",
          // Style the native textarea itself (not the outlined root) so
          // its metrics match the mirror exactly. Two classes of
          // specificity also beats MUI's multiline padding reset.
          "& .MuiInputBase-input": {
            ...TEXT_METRICS,
            position: "relative",
            zIndex: 1,
            backgroundColor: "transparent",
            ...(hasHighlight
              ? {
                  color: "transparent",
                  caretColor: theme.palette.text.primary,
                  WebkitTextFillColor: "transparent",
                }
              : {}),
          },
          // disabled=true makes text grayed out.
          // -> Keep the title looking like normal text in read.
          // While highlighting, the mirror owns the visible glyphs, so
          // the textarea itself must stay transparent even when disabled.
          "& .MuiInputBase-input.Mui-disabled": {
            WebkitTextFillColor: hasHighlight
              ? "transparent"
              : theme.palette.text.primary,
          },
        }}
      />
    </Box>
  );
});

NoteSourceEditorImpl.displayName = "NoteSourceEditorImpl";

/** Memoized source editor surface; outside-source changes do not re-render it. */
export const NoteSourceEditor = memo(NoteSourceEditorImpl);
