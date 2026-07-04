import React from "react";
import { Stack } from "@mui/material";
import { M1 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";

export interface UpperPanelProps {
  /** Sections stacked vertically. */
  children: React.ReactNode;
  /** Spacing multiplier between sections. Defaults to 2. */
  spacing?: number;
}

/**
 * Container for sections stacked in a side panel.
 *
 * Centralizes the section-to-section spacing so each `PanelSection` doesn't
 * need to coordinate with its neighbors.
 */
export const UpperPanel: React.FC<UpperPanelProps> = ({
  children,
  spacing = 4,
}) => {
  const { theme } = useThemeStore();
  return (
    <Stack spacing={theme.spacing(spacing)} sx={{ px: M1 }}>
      {children}
    </Stack>
  );
};
