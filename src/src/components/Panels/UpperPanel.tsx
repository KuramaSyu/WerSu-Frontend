import React from "react";
import { Box, Stack } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";

/**
 * Visual style for the panel shell.
 *
 *   - `"plain"` (default): transparent, no border, no shadow. Used on
 *     the LEFT rail, where the rail itself already paints the canvas
 *     (background.default) and content sits directly on it.
 *   - `"outlined"`: paper background with a 1px divider-coloured
 *     border and elevation 0. Used on the RIGHT rail, which is
 *     transparent and sits on the shell's paper canvas — the outlined
 *     shell groups the section children into one visible card so they
 *     read as outlined boxes rather than loose rows.
 */
export type UpperPanelVariant = "plain" | "outlined";

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
  /**
   * Shell variant. Defaults to `"plain"` for backwards compatibility
   * with the left rail. Right-rail callers pass `"outlined"` to get
   * the bordered card grouping.
   */
  variant?: UpperPanelVariant;
}

/**
 * Canonical side-rail panel: section spacing and the scroll container.
 *
 * The default `"plain"` variant has no shell — content sits directly
 * on the rail's canvas. The `"outlined"` variant wraps the sections
 * in a paper-toned card with a 1px border, used by the right rail so
 * its content reads as outlined boxes against the shell's paper
 * canvas.
 *
 * Every side-rail call-site routes through this component so the
 * spacing and shape can never drift apart.
 */
export const UpperPanel: React.FC<UpperPanelProps> = ({
  children,
  spacing = 2,
  header,
  variant = "plain",
}) => {
  const { theme } = useThemeStore();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        ...(variant === "outlined" && {
          // Right-rail outline: a single vertical line on the left
          // edge (matches the visual "this section sits next to the
          // canvas" reading) instead of a full 4-sided border. The
          // left rail keeps the plain variant (no border at all).
          backgroundColor: theme.palette.background.paper,
          borderLeft: `1px solid ${theme.palette.divider}`,
        }),
      }}
    >
      <Box sx={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {header}
        <Box sx={{ py: 2, pr: 2, pl: 1 }}>
          <Stack spacing={spacing} direction="column">
            {children}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};
