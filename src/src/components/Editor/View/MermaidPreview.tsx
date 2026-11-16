// Live preview for a Mermaid code block.
//
// The component is deliberately self-contained: it only knows about the
// `renderMermaid` seam, never about the `mermaid` package itself. That keeps
// the heavy import lazy (see ../mermaid/mermaidRenderer.ts) and makes the
// component renderable in jsdom, where Mermaid cannot run at all.

import { Box, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import {
  renderMermaid,
  type MermaidTheme,
} from "../mermaid/mermaidRenderer";

export interface MermaidPreviewProps {
  /** Mermaid source. Empty/whitespace renders the "Empty diagram" state. */
  code: string;
  /** Mermaid theme; defaults to the renderer's `"default"`. */
  theme?: MermaidTheme;
}

/**
 * Typing a diagram char-by-char would re-render Mermaid (and re-parse the
 * whole diagram) on every keystroke. A short debounce keeps the preview
 * responsive while the user pauses.
 */
const RENDER_DEBOUNCE_MS = 250;

/** Collapses a rejection into a single truncated line for the error box. */
const errorMessage = (reason: unknown): string => {
  const raw = reason instanceof Error ? reason.message : String(reason);
  const singleLine = raw.replace(/\s+/g, " ").trim();
  return singleLine.length > 0 ? singleLine : "Failed to render diagram";
};

/**
 * Render output plus the source it belongs to.
 *
 * Pairing each result with its source is what lets the component skip
 * state updates in the effect body: the empty/error/placeholder states are
 * derived from these pairs during render instead of being pushed into
 * state synchronously.
 */
interface PreviewState {
  svg: string | null;
  error: string | null;
  errorCode: string | null;
}

const INITIAL_PREVIEW_STATE: PreviewState = {
  svg: null,
  error: null,
  errorCode: null,
};

export const MermaidPreview = ({
  code,
  theme = "default",
}: MermaidPreviewProps) => {
  const [state, setState] = useState<PreviewState>(INITIAL_PREVIEW_STATE);

  // Monotonic request id. A result is only applied when it belongs to the
  // newest request, so an older, slower render can never overwrite a newer
  // diagram even if its promise settles later.
  const requestIdRef = useRef(0);

  const isEmpty = code.trim().length === 0;
  // A diagram rendered for previous source stays visible while the next
  // one is being prepared (no flicker), but never for an emptied block.
  const svg = isEmpty ? null : state.svg;
  // An error is bound to the source that caused it, so typing the fix
  // immediately clears the note instead of leaving it stale.
  const error = state.errorCode === code ? state.error : null;

  useEffect(() => {
    // Why: every new source invalidates whatever is still in flight.
    requestIdRef.current += 1;

    if (isEmpty) {
      return;
    }

    const requestId = requestIdRef.current;
    let cancelled = false;

    // Debounce inside the effect and only touch state from the async
    // callbacks: a synchronous setState here would cascade renders on
    // every keystroke.
    const timer = window.setTimeout(() => {
      renderMermaid(code, theme)
        .then((nextSvg) => {
          if (cancelled || requestId !== requestIdRef.current) {
            return;
          }
          setState({ svg: nextSvg, error: null, errorCode: null });
        })
        .catch((reason: unknown) => {
          if (cancelled || requestId !== requestIdRef.current) {
            return;
          }
          // Keep the last good diagram visible; only add the error note.
          setState((previous) => ({
            ...previous,
            error: errorMessage(reason),
            errorCode: code,
          }));
        });
    }, RENDER_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, theme, isEmpty]);

  return (
    <Box
      data-mermaid-preview=""
      role="img"
      aria-label="Mermaid diagram"
      sx={{ width: "100%", minWidth: 0 }}
    >
      {svg !== null && (
        <Box
          data-mermaid-svg=""
          sx={{
            overflowX: "auto",
            py: 1,
            "& svg": {
              maxWidth: "100%",
              height: "auto",
              display: "block",
              margin: "0 auto",
            },
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}

      {isEmpty && (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 1 }}>
          Empty diagram
        </Typography>
      )}

      {!isEmpty && svg === null && error === null && (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 1 }}>
          Rendering diagram…
        </Typography>
      )}

      {error !== null && (
        <Box
          data-mermaid-error=""
          sx={{
            color: "error.main",
            fontSize: "0.8125rem",
            py: 0.5,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {error}
        </Box>
      )}
    </Box>
  );
};