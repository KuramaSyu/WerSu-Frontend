import {
  Box,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useState, type ReactNode } from "react";
import { ConfirmationModal } from "./ConfirmationModal";

export interface SettingsSectionProps {
  /** DOM id used as an anchor target for scroll-into-view navigation. */
  id: string;
  /** Section title rendered above the body and as the active-section label. */
  label: string;
  /** Optional icon shown in the section header. */
  icon?: ReactNode;
  /** Optional one-line summary shown under the section title. */
  description?: ReactNode;
  /** Body content. Forced to remount when reset fires so internal state refreshes. */
  children: React.ReactNode;
  /**
   * Optional callback that resets the section's settings. When provided,
   * a reset button is rendered next to the title; clicking it opens the
   * confirmation modal.
   */
  resetLogic?: () => void;
}

/**
 * One block in the Settings page: a Paper card with a tinted title row
 * (optional icon + reset button), followed by the section body.
 *
 * The body is wrapped in a key tied to a remount counter so `resetLogic`
 * always re-runs cleanly: clicking reset bumps `resetKey`, the body
 * remounts, and any uncontrolled inputs inside go back to their defaults
 * without the parent having to know about them.
 *
 * Section spacing is owned by the page-level stack, not by this component,
 * so cards can be re-ordered or filtered without leaving stray gaps or
 * trailing dividers behind.
 */
export const SettingsSection: React.FC<SettingsSectionProps> = ({
  id,
  label,
  icon,
  description,
  children,
  resetLogic,
}) => {
  // Bump on every confirmed reset so `children` remount and any
  // uncontrolled state inside is rebuilt from defaults.
  const [resetKey, setResetKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = () => {
    resetLogic?.();
    setResetKey((prev) => prev + 1);
    setConfirmOpen(false);
  };

  return (
    <Paper
      component="section"
      id={id}
      elevation={0}
      sx={{
        scrollMarginTop: 96,
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        sx={{
          px: { xs: 2, md: 2.5 },
          py: { xs: 1.75, md: 2 },
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: (theme) =>
            alpha(
              theme.palette.primary.main,
              theme.palette.mode === "dark" ? 0.07 : 0.04,
            ),
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", minWidth: 0 }}
        >
          {icon !== undefined && (
            <Box
              aria-hidden
              sx={{
                display: "grid",
                placeItems: "center",
                width: 38,
                height: 38,
                flexShrink: 0,
                borderRadius: 1.75,
                color: "primary.main",
                backgroundColor: (theme) =>
                  alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === "dark" ? 0.16 : 0.1,
                  ),
                "& svg": { fontSize: 20 },
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h2"
              variant="h6"
              sx={{
                fontSize: { xs: "1.0625rem", md: "1.125rem" },
                fontWeight: 600,
                lineHeight: 1.3,
              }}
            >
              {label}
            </Typography>
            {description !== undefined && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.25, lineHeight: 1.45 }}
              >
                {description}
              </Typography>
            )}
          </Box>
        </Stack>
        {resetLogic && (
          <Tooltip title={`Reset ${label} settings`} arrow placement="top">
            <IconButton
              aria-label={`Reset ${label} settings`}
              onClick={() => setConfirmOpen(true)}
              color="warning"
              size="small"
              sx={{ flexShrink: 0 }}
            >
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Box key={resetKey} sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
        {children}
      </Box>
      <ConfirmationModal
        title="Are you sure?"
        message={`This will reset all settings of ${label}.`}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        open={confirmOpen}
      />
    </Paper>
  );
};
