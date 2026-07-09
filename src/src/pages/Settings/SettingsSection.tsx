import {
  Box,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useState } from "react";
import { ConfirmationModal } from "./ConfirmationModal";

export interface SettingsSectionProps {
  /** DOM id used as an anchor target for scroll-into-view navigation. */
  id: string;
  /** Section title rendered above the body and as the active-section label. */
  label: string;
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
 * One block in the Settings page: title row (with optional reset button),
 * divider, then `children`.
 *
 * The body is wrapped in a key tied to a remount counter so `resetLogic`
 * always re-runs cleanly: clicking reset bumps `resetKey`, the body
 * remounts, and any uncontrolled inputs inside go back to their defaults
 * without the parent having to know about them.
 */
export const SettingsSection: React.FC<SettingsSectionProps> = ({
  id,
  label,
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
    <Box id={id} sx={{ scrollMarginTop: 80, mb: 6 }}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h6">{label}</Typography>
        {resetLogic && (
          <Tooltip title={`Reset ${label} settings`} arrow placement="top">
            <IconButton
              aria-label={`Reset ${label} settings`}
              onClick={() => setConfirmOpen(true)}
              color="warning"
            >
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Box key={resetKey} sx={{ mt: 2 }}>
        {children}
      </Box>
      <ConfirmationModal
        title="Are you sure?"
        message={`This will reset all settings of ${label}.`}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        open={confirmOpen}
      />
      <Divider sx={{ mt: 4 }} />
    </Box>
  );
};
