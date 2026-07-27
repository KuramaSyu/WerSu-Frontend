import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import { blendAgainstContrast } from "../utils/blendWithContrast";
import type { CustomTheme } from "../theme/customTheme";
import { useThemeStore } from "../zustand/useThemeStore";

export interface ColoredCollapseButtonProps {
  /** Label revealed on hover. When omitted, no label animates in. */
  whenSelected?: React.ReactNode;
  /**
   * Accent color driving border + selected background. The label
   * also inherits this color via `color: inherit`.
   */
  color: string;
  /** Selected state (when true, the background fills with `color`). */
  selected?: boolean;
  /** Per-step collapse timeout. Defaults to 200ms. */
  timeout?: number;
  /** Spacing between icon and label. Defaults to 1. */
  gap?: number;
  /** Forwarded to the underlying `Button`. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Disable interaction. */
  disabled?: boolean;
  /** Override or extend the styles applied to the `Button`. */
  sx?: any;
  /** All other props are forwarded to the underlying `Button`. */
  [key: string]: any;
}

/**
 * A regular (non-toggle) button that animates a label in/out of view
 * on hover, with a caller-supplied accent color driving the border
 * and selected state.
 *
 * Combines `ColoredToggleButton`'s accent-color styling with
 * `CollapseToggleButton`'s `whenSelected` label animation. The icon
 * is always rendered; the label slides in horizontally on hover
 * (and on the `selected` state) via MUI's `Collapse`.
 *
 * Intended for standalone actions (e.g. speed-dial sub-items) where
 * a `ToggleButtonGroup` isn't needed.
 *
 * Example:
 * ```tsx
 * <ColoredCollapseButton
 *   color="#FF5733"
 *   whenSelected={<Typography>New note</Typography>}
 *   onClick={handleCreate}
 * >
 *   <CreateIcon fontSize="small" />
 * </ColoredCollapseButton>
 * ```
 */
export const ColoredCollapseButton: React.FC<ColoredCollapseButtonProps> = ({
  whenSelected,
  color,
  selected = false,
  timeout = 200,
  gap = 1,
  children,
  sx,
  ...props
}) => {
  // Pull the live theme so the hover blends match the surrounding
  // palette. `useThemeStore` returns the `CustomTheme` instance
  // (a `Theme` superset) so it's compatible with the helpers in
  // `utils/blendWithContrast`.
  const { theme } = useThemeStore();
  // Track hover locally so the label can slide in even when the
  // button isn't `selected`. `selected` keeps the label visible
  // when the parent pins the button in the "on" state.
  const [hovered, setHovered] = React.useState(false);
  const showLabel = Boolean(whenSelected) && (hovered || selected);

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          // Push the icon (rendered first) to the right edge so the
          // label grows leftward when it appears, instead of
          // overflowing past the button's right edge.
          flexDirection: "row-reverse",
          position: "absolute",
          // place it left of the buttons left edge
          right: 40,
          top: 0,
          bottom: 0,
        }}
      >
        {whenSelected && (
          <Collapse
            orientation="horizontal"
            in={showLabel}
            timeout={timeout}
            unmountOnExit
          >
            <Box
              sx={{
                whiteSpace: "nowrap",
                pr: gap,
                background: theme.blendAgainstContrast(color, 0.1, undefined),
                color: theme.palette.getContrastText(color),
                px: 2,
                py: 1,
                borderRadius: theme.shape.borderRadius,
                zIndex: 1,
              }}
            >
              {whenSelected}
            </Box>
          </Collapse>
        )}
      </Box>
      <Button
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        // Contained look: the background is always filled with
        // `color`, and the icon/label inherit the contrast text so
        // they read against the fill. The `gap` flexes to the left
        // when the label appears so the icon stays pinned to the
        // right edge.
        sx={{
          gap: 0,
          minWidth: 0,
          paddingX: 2,
          paddingY: 1,
          zIndex: 2,
          color: theme.palette.getContrastText(color),
          backgroundColor: color,
          borderRadius: "2rem",
          textTransform: "none",
          "&:hover": {
            backgroundColor: blendAgainstContrast(color, theme, 0),
          },
          // The default `RootColorAndRadius` from `customTheme`
          // tries to animate `borderRadius` and `border-color`; this
          // `sx` runs after and pins the visual.
          ...(sx as object),
        }}
        {...props}
      >
        {children}
      </Button>
    </Box>
  );
};

/**
 * Re-export of the `blendAgainstContrast` helper so callers can
 * build `color` values that match the resting/hover blends this
 * component uses internally.
 */
export { blendAgainstContrast };
export type { CustomTheme };
