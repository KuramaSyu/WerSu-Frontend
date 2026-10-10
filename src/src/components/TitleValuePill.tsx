import { Box, darken, Paper, Stack, Typography } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";

/**
 * Pill with a soft `muted`-palette backdrop, a textual `title` on the
 * left, and a brighter `value` chip on the right. Used wherever a label
 * and its value should read as one unit in the metadata blocks (parent
 * directories, content stats, permission rows, ...).
 *
 * Sizes map to MUI's `Typography` variants and trim padding proportionally:
 *   - `small` (default) -> caption title + body2 value, pill stays a single text-line tall
 *   - `medium` -> body2 title + body1 value, more breathing room
 */
export type TitleValuePillSize = "small" | "medium";

export interface TitleValuePills {
  title: string;
  value: string;
  size?: TitleValuePillSize;
}

// Two size tables so the rendering style and the vertical padding live
// next to each other; flip a row to retune one pill size in isolation.
const TITLE_VARIANT_BY_SIZE: Record<TitleValuePillSize, "caption" | "body2"> = {
  small: "caption",
  medium: "body2",
};

const VALUE_VARIANT_BY_SIZE: Record<TitleValuePillSize, "body2" | "body1"> = {
  small: "body2",
  medium: "body1",
};

const PILL_PY_BY_SIZE: Record<TitleValuePillSize, number> = {
  small: 0,
  medium: 1,
};

const VALUE_PY_BY_SIZE: Record<TitleValuePillSize, number> = {
  small: 0.125,
  medium: 0.25,
};

const VALUE_PX_BY_SIZE: Record<TitleValuePillSize, number> = {
  small: 0.5,
  medium: 0.75,
};

export const TitleValuePill: React.FC<TitleValuePills> = ({
  title,
  value,
  size = "small",
}) => {
  const { theme } = useThemeStore();
  return (
    <Paper elevation={1} sx={{ borderRadius: theme.shape.borderRadius }}>
      <Stack
        sx={{
          pl: 0.75,
          pr: VALUE_PX_BY_SIZE[size],
          py: PILL_PY_BY_SIZE[size],
          alignItems: "center",
          gap: 0.5,
          lineHeight: 1,
        }}
        direction="row"
      >
        <Typography
          variant={TITLE_VARIANT_BY_SIZE[size]}
          sx={{ textTransform: "capitalize", lineHeight: 1.4 }}
        >
          {title}
        </Typography>
        <Box
          sx={{
            backgroundColor: theme.palette.secondary.main,
            color: theme.palette.secondary.contrastText,
            zIndex: 2,
            borderRadius: theme.shape.borderRadius,
            px: VALUE_PX_BY_SIZE[size],
            py: VALUE_PY_BY_SIZE[size],
            display: "inline-flex",
            alignItems: "center",
            lineHeight: 1,
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
      </Stack>
    </Paper>
  );
};
