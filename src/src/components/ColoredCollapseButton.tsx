import React from "react";
import Button from "@mui/material/Button";
import Tooltip, { type TooltipProps } from "@mui/material/Tooltip";
import { blendAgainstContrast } from "../utils/blendWithContrast";
import type { CustomTheme } from "../theme/customTheme";
import { useThemeStore } from "../zustand/useThemeStore";

export interface TooltipButtonProps {
  /**
   * Accent color driving the button's background fill and hover
   * blend. The icon inherits the contrast text for this color.
   */
  color: string;
  /** Tooltip content. When omitted, no tooltip wraps the button. */
  tooltipTitle?: React.ReactNode;
  /** Tooltip placement. Defaults to `'left'` to match the previous label. */
  tooltipPlacement?: TooltipProps["placement"];
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
 * A regular button that uses MUI's standard `Tooltip` to label
 * itself on hover, with a caller-supplied accent color driving
 * the background fill.
 *
 * Intended for standalone actions (e.g. speed-dial sub-items)
 * where a `ToggleButtonGroup` isn't needed.
 *
 * Example:
 * ```tsx
 * <TooltipButton
 *   color="#FF5733"
 *   tooltipTitle="New note"
 *   tooltipPlacement="left"
 *   onClick={handleCreate}
 * >
 *   <CreateIcon fontSize="small" />
 * </TooltipButton>
 * ```
 */
export const TooltipButton: React.FC<TooltipButtonProps> = ({
  color,
  tooltipTitle,
  tooltipPlacement = "left",
  children,
  sx,
  ...props
}) => {
  // Pull the live theme so the hover blends match the surrounding
  // palette. `useThemeStore` returns the `CustomTheme` instance
  // (a `Theme` superset) so it's compatible with the helpers in
  // `utils/blendWithContrast`.
  const { theme } = useThemeStore();
  const button = (
    <Button
      sx={{
        minWidth: 0,
        paddingX: 2,
        paddingY: 1,
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
  );

  if (!tooltipTitle) {
    return button;
  }

  return (
    <Tooltip title={tooltipTitle} placement={tooltipPlacement} arrow>
      {/* span wrapper lets the Tooltip attach a ref when the Button is disabled */}
      <span>{button}</span>
    </Tooltip>
  );
};

/**
 * Re-export of the `blendAgainstContrast` helper so callers can
 * build `color` values that match the resting/hover blends this
 * component uses internally.
 */
export { blendAgainstContrast };
export type { CustomTheme };
