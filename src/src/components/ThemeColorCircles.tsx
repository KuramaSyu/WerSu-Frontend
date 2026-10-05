import React from "react";
import { Box, type Theme } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";

type CircleKey = "primary" | "secondary" | "paper" | "default";

type CirclePalette = Record<CircleKey, string>;

// Extract the four colors the circles preview from a theme's palette.
function paletteFromTheme(theme: Theme): CirclePalette {
  return {
    primary: theme.palette.primary.main,
    secondary: theme.palette.secondary.main,
    paper: theme.palette.background.paper,
    default: theme.palette.background.default,
  };
}

export interface ThemeColorCirclesProps {
  // Render the preview for this specific theme instead of the active one.
  // Useful for the theme picker, which previews every option in turn.
  theme?: Theme;
  // Per-circle override; omitted keys fall back to `theme` (or the
  // active theme when `theme` is omitted). Wins over `theme` when supplied.
  palette?: Partial<CirclePalette>;
  // Diameter of a single circle, in px. The full row is 2.5x this
  // (4 circles overlapping by half: 1 + 3*0.5 = 2.5).
  circleSize?: number;
  // Accessible label for the rendered image role.
  ariaLabel?: string;
  // Order of the four circles from left to right. Defaults to the
  // primary, secondary, paper, default order that the rest of the
  // app uses.
  order?: readonly CircleKey[];
}

const DEFAULT_ORDER: readonly CircleKey[] = [
  "primary",
  "secondary",
  "paper",
  "default",
];

// Overlapping circles previewing a theme's primary, secondary, paper, and
// default background colors. Reads the active theme from useThemeStore by
// default, but can also preview a specific theme (theme picker) or a fully
// custom palette (snapshot of the active theme at render time).
export const ThemeColorCircles: React.FC<ThemeColorCirclesProps> = ({
  theme: themeOverride,
  palette: paletteOverride,
  circleSize = 20,
  ariaLabel = "Theme color preview",
  order = DEFAULT_ORDER,
}) => {
  const { theme: activeTheme } = useThemeStore();
  const source = themeOverride ?? activeTheme;
  const colors = { ...paletteFromTheme(source), ...paletteOverride };
  // Each subsequent circle starts at half its diameter, so the row
  // grows by 0.5 * circleSize per step.
  const step = circleSize * 0.5;
  const width = circleSize + step * (order.length - 1);
  return (
    <Box
      role="img"
      aria-label={ariaLabel}
      data-testid="theme-color-circles"
      sx={{ position: "relative", width, height: circleSize }}
    >
      {order.map((key, i) => (
        <Box
          key={key}
          data-testid={`theme-circle-${key}`}
          sx={{
            position: "absolute",
            top: 0,
            left: i * step,
            width: circleSize,
            height: circleSize,
            borderRadius: "50%",
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: colors[key],
          }}
        />
      ))}
    </Box>
  );
};
