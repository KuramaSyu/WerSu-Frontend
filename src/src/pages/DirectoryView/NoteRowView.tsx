import { Box, Stack, Typography } from "@mui/material";
import { memo, useMemo } from "react";
import type { MinimalNote } from "../../api/models/search";
import { markdownPreview } from "../../utils/markdownPreview";

export interface NoteRowViewProps {
  note: MinimalNote;
  /** 4px accent bar color. */
  accentColor: string;
  /**
   * Bar height in pixels. Larger for top-level notes, smaller for nested
   * notes to signal the hierarchy level.
   */
  barHeight?: number;
  /** When true, the body uses `body1` (matches nested-row weight). */
  compact?: boolean;
}

/**
 * Pure presentational row for a note entry.
 *
 * Shows the note title plus a two-line preview rendered via
 * `markdownPreview`. Non-interactive on its own - callers wrap it in
 * `ButtonBase` to attach navigation behavior.
 */
export const NoteRowView: React.FC<NoteRowViewProps> = memo(
  ({ note, accentColor, barHeight = 44, compact = false }) => {
    // `markdownPreview` strips table pipes, bold/italic markers, and other
    // markdown syntax, then keeps up to `maxLength + 100` chars so the
    // two-line CSS clamp never has to count characters.
    const previewText = useMemo(
      () => markdownPreview(note.stripped_content),
      [note.stripped_content],
    );

    return (
      <Stack
        direction="row"
        spacing={2}
        sx={{
          alignItems: "flex-start",
          width: "100%",
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: 4,
            alignSelf: "stretch",
            minHeight: barHeight,
            borderRadius: 999,
            backgroundColor: accentColor,
            flexShrink: 0,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant={compact ? "body1" : "subtitle1"}
            sx={{ fontWeight: 600 }}
            noWrap
          >
            {note.title}
          </Typography>
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {previewText}
          </Typography>
        </Box>
      </Stack>
    );
  },
);
NoteRowView.displayName = "NoteRowView";
