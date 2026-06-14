import type { Theme } from "@emotion/react";
import { styled, ToggleButton } from "@mui/material";
import type { CustomTheme } from "../theme/customTheme";
import { blendAgainstContrast } from "../utils/blendWithContrast";

export interface ColoredToggleButtonProps {
  accentColor: string;
}

/**
 * A styled toggle button component with customizable accent color.
 *
 * @template ColoredToggleButtonProps - The props interface for the colored toggle button
 * @param accentColor - The primary color for the button's border and background when selected
 *
 * @example
 * ```tsx
 * <ColoredToggleButton accentColor="#FF5733" value="option1">
 *   Toggle Me
 * </ColoredToggleButton>
 * ```
 *
 * @remarks
 * - The button displays the accent color as its border in default state
 * - On hover, the border color blends against the theme's contrast (30% adjustment)
 * - When selected, the background becomes the accent color with contrasting text
 * - On hover while selected, the background blends slightly (20% adjustment) for better UX
 * - The `accentColor` prop is not forwarded to the DOM element
 * - Uses MUI's `theme.palette.getContrastText()` for accessible text colors
 */
export const ColoredToggleButton = styled(ToggleButton, {
  shouldForwardProp: (prop) => prop !== "accentColor",
})<ColoredToggleButtonProps>(({ theme, accentColor }) => ({
  color: accentColor,
  border: `1px solid ${accentColor}`,
  borderRadius: "2rem",
  "&:hover": {
    //color: blendAgainstContrast(accentColor, theme, 0.3),
    borderColor: blendAgainstContrast(accentColor, theme, 0.3),
  },
  "&.Mui-selected": {
    backgroundColor: accentColor,
    color: theme.palette.getContrastText(accentColor!),

    "&:hover": {
      backgroundColor: blendAgainstContrast(accentColor, theme, 0.2),
      color: theme.palette.getContrastText(
        blendAgainstContrast(accentColor, theme, 0.3),
      ),
    },
  },
}));

export const OutlinedToggleButton = styled(ToggleButton, {
  shouldForwardProp: (prop) => prop !== "accentColor",
})<ColoredToggleButtonProps>(({ theme, accentColor }) => ({
  color: theme.palette.text.disabled,
  border: `1px solid ${theme.palette.text.disabled}`,
  borderRadius: "2rem",
  "&:hover": {
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.text.primary}`,
  },
  "&.Mui-selected": {
    color: accentColor,
    border: `1px solid ${accentColor}`,

    "&:hover": {
      // backgroundColor: blendAgainstContrast(accentColor, theme, 0.8),
      color: blendAgainstContrast(accentColor, theme, 0.3),

      border: `1px solid ${blendAgainstContrast(accentColor, theme, 0.3)}`,
    },
  },
}));
