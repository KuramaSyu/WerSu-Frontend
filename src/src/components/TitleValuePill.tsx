import { Box, Paper, Typography } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";

/**
 * Pill with a title capsule cut into a value-coloured outer pill.
 *
 * The outer container carries the value colour. The title capsule sits on
 * top of that background and overlaps the value side, so its rounded right
 * edge reads as a cut-out in the value rather than as a second pill beside
 * it. The value text then runs to the right edge on the outer background.
 *
 * Sizes map to MUI's `Typography` variants and trim padding proportionally:
 *   - `small` (default) -> caption title + body2 value, pill stays a single text-line tall
 *   - `medium` -> body2 title + body1 value, more breathing room
 *   - `large` -> subtitle1 title + h6 value, for prominent inline summaries
 *
 * Set `inline` to render the pill as an inline-flex span so it can sit inside
 * a sentence without breaking the paragraph into block-level rows.
 *
 * `color` selects the value background palette; it defaults to `secondary`.
 */
export type TitleValuePillSize = "small" | "medium" | "large";
export type TitleValuePillColor = "primary" | "secondary";

export interface TitleValuePills {
  title: string;
  value: string;
  size?: TitleValuePillSize;
  inline?: boolean;
  color?: TitleValuePillColor;
}

const TITLE_VARIANT_BY_SIZE: Record<
  TitleValuePillSize,
  "caption" | "body2" | "subtitle1"
> = {
  small: "caption",
  medium: "body2",
  large: "subtitle1",
};

const VALUE_VARIANT_BY_SIZE: Record<
  TitleValuePillSize,
  "body2" | "body1" | "h6"
> = {
  small: "body2",
  medium: "body1",
  large: "h6",
};

const TITLE_PX_BY_SIZE: Record<TitleValuePillSize, number> = {
  small: 0.75,
  medium: 1,
  large: 1,
};

const VALUE_PX_BY_SIZE: Record<TitleValuePillSize, number> = {
  small: 0.75,
  medium: 1,
  large: 1,
};

const VALUE_PY_BY_SIZE: Record<TitleValuePillSize, number> = {
  small: 0.125,
  medium: 0.25,
  large: 0.25,
};

export const TitleValuePill: React.FC<TitleValuePills> = ({
  title,
  value,
  size = "small",
  inline = false,
  color = "secondary",
}) => {
  const { theme } = useThemeStore();
  const component = inline ? "span" : "div";
  const valuePalette =
    color === "primary" ? theme.palette.primary : theme.palette.secondary;

  return (
    <Paper
      component={component}
      elevation={0}
      sx={{
        display: inline ? "inline-flex" : "flex",
        verticalAlign: inline ? "middle" : undefined,
        alignItems: "stretch",
        borderRadius: 999,
        overflow: "hidden",
        backgroundColor: valuePalette.main,
        color: valuePalette.contrastText,
        mx: inline ? 0.25 : 0,
      }}
    >
      <Box
        component={component}
        sx={{
          position: "relative",
          zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
          px: TITLE_PX_BY_SIZE[size],
          borderRadius: 999,
          border: 1,
          borderColor: "divider",
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
        }}
      >
        <Typography
          variant={TITLE_VARIANT_BY_SIZE[size]}
          sx={{ textTransform: "capitalize", lineHeight: 1.4, fontWeight: 600 }}
        >
          {title}
        </Typography>
      </Box>
      <Box
        component={component}
        sx={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          px: VALUE_PX_BY_SIZE[size],
          py: VALUE_PY_BY_SIZE[size],
        }}
      >
        <Typography
          variant={VALUE_VARIANT_BY_SIZE[size]}
          component="span"
          sx={{ lineHeight: 1 }}
        >
          {value}
        </Typography>
      </Box>
    </Paper>
  );
};
