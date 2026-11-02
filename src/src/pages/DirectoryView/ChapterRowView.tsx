import { Box, Stack, Typography } from "@mui/material";
import { memo } from "react";
import { chapterCountsLabel } from "./chapterCountsLabel";

export interface ChapterRowViewProps {
  /** Display name (already resolved: `display_name` falls back to `name`). */
  name: string;
  /** Page count from the backend (or fallback). */
  pages: number;
  /** Subdirectory count from the backend (or fallback). */
  subdirectories: number;
  /** 4px accent bar color. */
  accentColor: string;
  /**
   * Bar height in pixels. Larger for top-level chapters, smaller for nested
   * sub-chapters to signal the hierarchy level.
   */
  barHeight?: number;
  /** When true, the title uses `body1` (matches nested-row weight). */
  compact?: boolean;
}

/**
 * Pure presentational row for a chapter (directory) entry.
 *
 * Used both at the top level (as the accordion summary) and inside expanded
 * accordions for nested chapters. The row is non-interactive on its own -
 * callers wrap it in `ButtonBase` or `AccordionSummary` to attach behavior.
 */
export const ChapterRowView: React.FC<ChapterRowViewProps> = memo(
  ({
    name,
    pages,
    subdirectories,
    accentColor,
    barHeight = 36,
    compact = false,
  }) => (
    <Stack
      direction="row"
      spacing={2}
      sx={{ alignItems: "center", width: "100%", minWidth: 0 }}
    >
      <Box
        sx={{
          width: 4,
          height: barHeight,
          borderRadius: 999,
          backgroundColor: accentColor,
          flexShrink: 0,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant={compact ? "body1" : "subtitle1"}
          sx={{
            fontWeight: 600,
            // Truncate with an ellipsis instead of a horizontal
            // scrollbar; `overflowX: "scroll"` kept the full
            // unwrapped text as the row's min-content width and
            // pushed long directory names past the row padding.
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          noWrap
        >
          {name}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {chapterCountsLabel(pages, subdirectories)}
        </Typography>
      </Box>
    </Stack>
  ),
);
ChapterRowView.displayName = "ChapterRowView";
