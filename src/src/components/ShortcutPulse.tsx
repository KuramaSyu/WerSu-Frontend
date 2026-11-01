import React, { useEffect, useRef } from "react";
import { Box, keyframes, Typography } from "@mui/material";
import {
  HOLD_BAR_HEIGHT,
  HOLD_BAR_WIDTH,
  M2,
  M3,
  TOP_BAR_HEIGHT,
} from "../statics";
import { useThemeStore } from "../zustand/useThemeStore";
import { useShortcutPulseStore } from "../zustand/useShortcutPulseStore";
import { KeyboardShortcut } from "../utils/renderShortcut";

/** How long the completion pulse sweeps for, in ms. */
export const SHORTCUT_PULSE_DURATION_MS = 450;

/** A shine that sweeps across the pill once a hold registers. */
const pulseAnimation = keyframes`
  0%   { transform: translateX(-130%); opacity: 0; }
  20%  { opacity: 0.9; }
  100% { transform: translateX(130%); opacity: 0; }
`;

/**
 * App-root confirmation pulse for hold-to-run shortcuts. Rendered
 * outside the editor tree so an action that remounts the editor
 * (entering/leaving insert mode) can never cut the pulse short.
 */
export const ShortcutPulse: React.FC = () => {
  const { theme } = useThemeStore();
  const pulse = useShortcutPulseStore((s) => s.pulse);
  const clearPulse = useShortcutPulseStore((s) => s.clearPulse);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pulse) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      clearPulse(pulse.id);
      timerRef.current = null;
    }, SHORTCUT_PULSE_DURATION_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pulse, clearPulse]);

  if (!pulse) {
    return null;
  }

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: "fixed",
        left: "50%",
        top: `calc(${TOP_BAR_HEIGHT} + ${M3})`,
        transform: "translateX(-50%)",
        zIndex: theme.zIndex.tooltip,
        display: "flex",
        height: HOLD_BAR_HEIGHT,
        width: HOLD_BAR_WIDTH,
        boxSizing: "border-box",
        borderRadius: 999,
        overflow: "hidden",
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        boxShadow: theme.shadows[8],
        border: `1px solid ${theme.palette.divider}`,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <Box
        data-testid="shortcut-pulse"
        data-pulse-key={pulse.key}
        sx={{
          position: "relative",
          flex: 1,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          backgroundColor: theme.palette.action.hover,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundColor: theme.palette.primary.main,
            opacity: 0.4,
          }}
        />
        <Box
          sx={{
            position: "relative",
            flex: 1,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: M2,
            paddingX: M2,
          }}
        >
          <KeyboardShortcut shortcut={pulse.keyLabel ?? pulse.key} />
          <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
            {pulse.label}
          </Typography>
        </Box>
        <Box
          key={pulse.id}
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}, transparent)`,
            animation: `${pulseAnimation} ${SHORTCUT_PULSE_DURATION_MS}ms ease-out forwards`,
          }}
        />
      </Box>
    </Box>
  );
};

export default ShortcutPulse;
