import type { ReactNode } from "react";
import {
  Box,
  Divider,
  Paper,
  Stack,
  Typography,
  alpha,
  type SxProps,
  type Theme,
} from "@mui/material";

export interface SettingsRowProps {
  /** Primary label for the setting. */
  title: ReactNode;
  /** Optional supporting copy rendered under the title. */
  description?: ReactNode;
  /** Control aligned to the end of the row (switch, button, select, ...). */
  control?: ReactNode;
  /** Extra content rendered under the description (e.g. a slider). */
  children?: ReactNode;
  /** Vertical alignment of the control on wide screens. */
  align?: "center" | "flex-start";
}

/**
 * One label / description / control row.
 *
 * Rows are designed to be stacked inside `SettingsGroup`, which owns the
 * divider between them. Keeping the row padding here means every settings
 * body has the same rhythm and no section has to hand-roll top/bottom
 * borders around its content.
 */
export const SettingsRow: React.FC<SettingsRowProps> = ({
  title,
  description,
  control,
  children,
  align = "center",
}) => (
  <Stack
    direction={{ xs: "column", sm: "row" }}
    spacing={{ xs: 1.5, sm: 2 }}
    sx={{
      alignItems: { xs: "stretch", sm: align },
      justifyContent: "space-between",
      py: 1.75,
      "&:first-of-type": { pt: 2 },
      "&:last-of-type": { pb: 2 },
    }}
  >
    <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        component="h4"
        variant="subtitle1"
        sx={{ fontSize: "0.9875rem", fontWeight: 600, lineHeight: 1.4 }}
      >
        {title}
      </Typography>
      {description !== undefined && (
        <Typography
          component="div"
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: "68ch", lineHeight: 1.55 }}
        >
          {description}
        </Typography>
      )}
      {children}
    </Stack>
    {control !== undefined && (
      <Box
        sx={{
          display: "flex",
          flexShrink: 0,
          alignItems: "center",
          alignSelf: { xs: "flex-start", sm: align },
        }}
      >
        {control}
      </Box>
    )}
  </Stack>
);

export interface SettingsGroupProps {
  /** Group heading such as "Layout" or "Performance mode". */
  title?: ReactNode;
  /** Optional supporting copy under the heading. */
  description?: ReactNode;
  /** Optional action rendered on the right of the heading. */
  action?: ReactNode;
  /** Group body. Sibling children are separated by a divider. */
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/**
 * Paper sub-surface used to group related settings inside a section card.
 *
 * Groups are deliberately one level quieter than the section itself: an
 * outlined Paper with a slightly recessed background. That gives settings
 * a three-level hierarchy (page -> section card -> group card) without
 * introducing extra horizontal rules.
 */
export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  action,
  children,
  sx,
}) => (
  <Paper
    variant="outlined"
    elevation={0}
    sx={[
      {
        borderRadius: 2,
        borderColor: "divider",
        backgroundColor: (theme) =>
          alpha(
            theme.palette.background.default,
            theme.palette.mode === "dark" ? 0.35 : 0.55,
          ),
        overflow: "hidden",
      },
      ...(Array.isArray(sx) ? sx : sx !== undefined ? [sx] : []),
    ]}
  >
    {title !== undefined ||
    description !== undefined ||
    action !== undefined ? (
      <Stack
        direction="row"
        spacing={2}
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: 1.75,
          alignItems: "flex-start",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          {title !== undefined && (
            <Typography
              component="h3"
              variant="subtitle1"
              sx={{ fontWeight: 600, lineHeight: 1.4 }}
            >
              {title}
            </Typography>
          )}
          {description !== undefined && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
        </Stack>
        {action !== undefined && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Stack>
    ) : null}
    <Stack
      divider={<Divider flexItem />}
      sx={{ px: { xs: 2, sm: 2.5 } }}
    >
      {children}
    </Stack>
  </Paper>
);
