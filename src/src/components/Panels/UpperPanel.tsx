import React from "react";
import { Box, Paper, Stack } from "@mui/material";
import { TOP_BAR_ELEVATION } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";

export interface UpperPanelProps {
  /** Sections stacked vertically inside the panel body. */
  children: React.ReactNode;
  /**
   * Spacing multiplier between sections. Defaults to 4 (16px), matching
   * the previous side-rail rhythm. Callers with denser content (e.g. the
   * note route) can pass a smaller value.
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
 * Canonical side-rail panel: the `Paper` shell, the section spacing, the
 * background, the rounded corners, the dark/light elevation, and the
 * inner scroll container all live here.
 *
 * Every left-rail call-site (Home, DirectoryView, Settings, the home
 * content view, the note route) routes through this component so the
 * shell, color, and shape can never drift apart.
 */
export const UpperPanel: React.FC<UpperPanelProps> = ({
  children,
  spacing = 4,
  header,
}) => {
  const { theme } = useThemeStore();
  return (
    <Paper
      elevation={theme.palette.mode === "dark" ? TOP_BAR_ELEVATION : 1}
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      <Box sx={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {header}
        <Box sx={{ p: 2 }}>
          <Stack spacing={theme.spacing(spacing)}>{children}</Stack>
        </Box>
      </Box>
    </Paper>
  );
};
