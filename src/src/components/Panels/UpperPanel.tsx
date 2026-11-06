import React from "react";
import { Box, Stack } from "@mui/material";
import { M3 } from "../../statics";

export interface UpperPanelProps {
  /** Sections stacked vertically inside the panel body. */
  children: React.ReactNode;
  /**
   * Gap between sections in MUI `Stack` units (8px each). Defaults to
   * 2 (16px). The previous default of 4 produced a 64px gap via the
   * `theme.spacing()` helper, which read as dead space next to short
   * sections like the nav row.
   */
  spacing?: number;
  /**
   * Optional header rendered at the top of the panel, above the scrolling
   * body. The header is a sibling of the children (not part of the
   * padded body Box) so it can carry its own padding / border-bottom
   * without inheriting the body's padding.
   */
  header?: React.ReactNode;
}

/**
 * Canonical side-rail panel: section spacing and the scroll container.
 *
 * The shell is intentionally transparent — it paints no background and
 * no border, so content sits directly on the rail's canvas (the page
 * background). Each child section owns its own surface: right-rail
 * callers pass `bordered` to `PanelSection` to get an outlined card,
 * while the left rail keeps plain, borderless rows. This keeps the
 * shell layout (spacing / scroll) in one place without forcing a single
 * surface style on every rail.
 *
 * Every side-rail call-site routes through this component so the
 * spacing and shape can never drift apart.
 */
export const UpperPanel: React.FC<UpperPanelProps> = ({
  children,
  spacing = 2,
  header,
}) => {
  return (
    <Box
      aria-label="Right Rail Content Wrapper"
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      <Box
        sx={{
          overflowY: "auto",
          overflowX: "hidden",
          // Left gutter for every side panel. On the right rail it gives
          // a first section's `leftEdgeHandle` room to straddle the
          // section border without being clipped by this scroll box; on
          // the left rail it insets the content from the window edge.
          // The matching outer padding is dropped from the main
          // content/outlet in `AppShell` so the gap is not doubled.
          pl: M3,
          flex: 1,
          minHeight: 0,
        }}
      >
        {header}
        <Box sx={{ py: 2 }}>
          <Stack spacing={spacing} direction="column">
            {children}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};
