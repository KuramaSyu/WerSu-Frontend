import React, { useCallback, useEffect, useRef, useState } from "react";
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
  // The sweep only starts once the pill has actually been painted, so
  // its CSS animation clock begins on a clean frame instead of during
  // the blocking render that the triggering action causes.
  const [armed, setArmed] = useState(false);
  // Reset the sweep whenever a new pulse arrives (adjust-state-during-
  // render, React's recommended pattern).
  const [prevPulse, setPrevPulse] = useState(pulse);
  if (prevPulse !== pulse) {
    setPrevPulse(pulse);
    setArmed(false);
  }

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Fallback clear for when the sweep's `animationend` never lands.
  useEffect(() => {
    if (!pulse) return;
    stopTimer();
    timerRef.current = window.setTimeout(
      () => {
        clearPulse(pulse.id);
        timerRef.current = null;
      },
      SHORTCUT_PULSE_DURATION_MS * 2 + 250,
    );
    return stopTimer;
  }, [pulse, clearPulse, stopTimer]);

  // Arm the sweep two frames after the pulse appears: the first frame
  // paints the idle pill, the second starts the animation from the top.
  useEffect(() => {
    if (!pulse) return;
    let raf = 0;
    raf = window.requestAnimationFrame(() => {
      raf = window.requestAnimationFrame(() => setArmed(true));
    });
    return () => window.cancelAnimationFrame(raf);
  }, [pulse]);

  const handleSweepEnd = useCallback(() => {
    if (!pulse) return;
    stopTimer();
    clearPulse(pulse.id);
  }, [pulse, clearPulse, stopTimer]);

  // A native listener (not React's `onAnimationEnd`) is used so the
  // event is observed regardless of how the environment synthesises
  // `animationend`, matching the hold bar's own fill handling. The
  // sweep node exists for as long as the pulse does, so this attaches
  // before `armed` flips.
  const sweepRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sweepRef.current;
    if (!node) return;
    node.addEventListener("animationend", handleSweepEnd);
    return () => node.removeEventListener("animationend", handleSweepEnd);
  }, [pulse, handleSweepEnd]);

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
          ref={sweepRef}
          aria-hidden
          data-testid="shortcut-pulse-sweep"
          data-motion-exempt="true"
          style={
            {
              "--motion-duration": `${SHORTCUT_PULSE_DURATION_MS}ms`,
            } as React.CSSProperties
          }
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: 0,
            background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}, transparent)`,
            ...(armed && {
              animation: `${pulseAnimation} ${SHORTCUT_PULSE_DURATION_MS}ms ease-out forwards`,
            }),
          }}
        />
      </Box>
    </Box>
  );
};

export default ShortcutPulse;
