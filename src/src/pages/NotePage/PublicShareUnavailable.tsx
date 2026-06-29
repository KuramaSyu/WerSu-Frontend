import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { M3 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";

/**
 * Rendered when the public-share grant can't be used:
 *
 *   - `usePublicShare` rejected (share ID unknown / expired / revoked).
 *   - The grant returned no `note_id` (backend mid-state, or share points
 *     at a deleted note).
 *   - The grant has an unexpected `permission` value.
 *
 * Provides a single CTA back to `/` so the viewer isn't stranded on a
 * blank surface. Intentionally small — the public route is meant to feel
 * light, so we don't show a stack-trace style error.
 */
export const PublicShareUnavailable: React.FC<{
  reason?: string;
}> = ({ reason }) => {
  const { theme } = useThemeStore();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: M3,
      }}
    >
      <Paper
        elevation={1}
        sx={{
          maxWidth: 420,
          p: M3,
          display: "flex",
          flexDirection: "column",
          gap: M3,
        }}
      >
        <Stack spacing={theme.spacing(1)}>
          <Typography variant="h4">Share unavailable</Typography>
          <Typography color="text.secondary">
            This share is missing, revoked, or expired.
            {reason ? ` (${reason})` : null}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={theme.spacing(1)}>
          <Button variant="contained" onClick={() => navigate("/")}>
            Back to home
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};
