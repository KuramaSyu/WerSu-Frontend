// ---------------------------------------------------------------------------
// NoteSourceEditor
// Source-mode TextField. Uses forwardRef so the page body can read
// the underlying textarea selection. Memoized: per-keystroke edits
// only re-render this surface.
// ---------------------------------------------------------------------------

import { forwardRef, memo, useImperativeHandle, useState } from "react";
import { Box, TextField } from "@mui/material";
import { logRerender } from "./editorRenderLog";

export interface NoteSourceEditorProps {
  sourceMarkdown: string;
  setSourceMarkdown: (markdown: string) => void;
  editorWidth: number | string;
}

export interface NoteSourceEditorHandle {
  /** Read the current selection range of the underlying textarea. */
  getSelectionRange: () => { start: number; end: number } | null;
}

const NoteSourceEditorImpl = forwardRef<
  NoteSourceEditorHandle,
  NoteSourceEditorProps
>(({ sourceMarkdown, setSourceMarkdown, editorWidth }, ref) => {
  logRerender("NoteSourceEditor", { sourceLen: sourceMarkdown.length });
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null);

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

  return (
    <Box
      sx={{
        width: editorWidth,
        mx: "auto",
        transition: (t) =>
          t.transitions.create("width", {
            duration: t.transitions.duration.complex,
          }),
      }}
    >
      <TextField
        value={sourceMarkdown}
        onChange={(event) => setSourceMarkdown(event.target.value)}
        multiline
        minRows={16}
        placeholder="Markdown source"
        fullWidth
        inputRef={setTextarea}
        sx={{
          fontFamily: "monospace",
          "& .MuiInputBase-input": { fontFamily: "monospace" },
        }}
      />
    </Box>
  );
});

NoteSourceEditorImpl.displayName = "NoteSourceEditorImpl";

/** Memoized source editor surface; outside-source changes do not re-render it. */
export const NoteSourceEditor = memo(NoteSourceEditorImpl);
