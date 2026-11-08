import React, { useCallback, useEffect, useRef } from "react";
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
import { useKeyHold, type HoldKeyAction } from "../hooks/useKeyHold";
import { KeyboardShortcut } from "../utils/renderShortcut";

export type { HoldKeyAction };

export interface HoldKeyActionBarProps {
  /**
   * Shows and arms the bar. When false the bar is hidden and any
   * in-flight hold is cancelled.
   */
  active: boolean;
  /**
   * One or more actions to advertise. Each entry drives its own key
   * badge, label and callback, so the bar can host completely
   * different buttons without changing this component.
   */
  actions: HoldKeyAction[];
  /** Default hold duration (ms) for actions without their own. */
  duration?: number;
  /** Where the floating bar anchors. Default "top". */
  position?: "top" | "bottom";
  /**
   * Capture phase for the key listener. Defaults to true so the bar
   * still works inside a MUI `Dialog` (which swallows Escape on
   * bubble). Set false on plain pages so descendants like a find bar
   * can handle Escape first.
   */
  capture?: boolean;
}

/** Grows the highlight from left to right while the key is held. */
const fillAnimation = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`;

interface BarContentProps {
  active: boolean;
  actions: HoldKeyAction[];
  duration: number;
  position: "top" | "bottom";
  capture: boolean;
}

/**
 * The mounted half of the bar. Kept mounted across `active`/`actions`
 * changes (only the listener toggles) so nothing depends on the editor
 * re-rendering the bar at a particular moment.
 */
const HoldKeyActionBarContent: React.FC<BarContentProps> = ({
  active,
  actions,
  duration,
  position,
  capture,
}) => {
  const theme = useThemeStore((state) => state.theme);
  const triggerPulse = useShortcutPulseStore((s) => s.triggerPulse);
  const { holding, complete } = useKeyHold({
    enabled: active,
    actions,
    capture,
  });
  const fillRef = useRef<HTMLDivElement | null>(null);
  // Guards against firing the same hold twice (e.g. when both the CSS
  // animation and the fallback timer manage to land).
  const firedRef = useRef(false);

  // Finish the hold: register the confirmation pulse *before* running
  // the action. The action can remount/rerender the editor subtree
  // (entering insert mode, leaving source view), and if that throws or
  // tears the bar down we must still have handed the pulse to the
  // app-level overlay, which lives outside the editor tree.
  const finishHold = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const finished = holding;
    if (finished) {
      triggerPulse({
        key: finished.key,
        keyLabel: finished.keyLabel,
        label: finished.label,
      });
    }
    complete();
  }, [holding, complete, triggerPulse]);

  // A fresh hold may fire again next time.
  useEffect(() => {
    if (holding) firedRef.current = false;
  }, [holding]);

  // A native listener is used (not React's onAnimationEnd) so it works
  // regardless of the environment's AnimationEvent support and never
  // drifts from the compositor-driven CSS animation.
  useEffect(() => {
    const node = fillRef.current;
    if (!node) return;
    node.addEventListener("animationend", finishHold);
    return () => node.removeEventListener("animationend", finishHold);
  }, [finishHold]);

  // Fallback: if the fill's `animationend` never arrives (the subtree
  // was remounted mid-hold, the tab throttled the animation, etc.)
  // complete on a timer so the action and pulse still land.
  useEffect(() => {
    if (!holding) return;
    const ms = (holding.duration ?? duration) + 50;
    const id = window.setTimeout(finishHold, ms);
    return () => window.clearTimeout(id);
  }, [holding, duration, finishHold]);

  // Nothing to show until the user presses a key.
  if (!holding) {
    return null;
  }

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: "fixed",
        left: "50%",
        ...(position === "bottom"
          ? { bottom: M3 }
          : { top: `calc(${TOP_BAR_HEIGHT} + ${M3})` }),
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
      {/* Only the key the user is actually holding is shown, so the
          bar never advertises an unrelated action. */}
      <Box
        data-testid={`hold-key-${holding.key}`}
        data-holding="true"
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
          ref={fillRef}
          data-testid={`hold-key-fill-${holding.key}`}
          data-motion-exempt="true"
          style={
            {
              "--motion-duration": `${holding.duration ?? duration}ms`,
            } as React.CSSProperties
          }
          sx={{
            position: "absolute",
            inset: 0,
            transformOrigin: "left center",
            backgroundColor: theme.palette.primary.main,
            opacity: 0.4,
            animation: `${fillAnimation} ${holding.duration ?? duration}ms linear forwards`,
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
          <KeyboardShortcut shortcut={holding.keyLabel ?? holding.key} />
          <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
            {holding.label}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

/**
 * A floating status bar that appears while the user holds a key,
 * filling up the matching pill. After the full duration the action
 * fires, a confirmation pulse plays at the app root, and the bar
 * disappears again. Nothing is shown while idle.
 */
export const HoldKeyActionBar: React.FC<HoldKeyActionBarProps> = ({
  active,
  actions,
  duration = 800,
  position = "top",
  capture = true,
}) => {
  return (
    <HoldKeyActionBarContent
      active={active}
      actions={actions}
      duration={duration}
      position={position}
      capture={capture}
    />
  );
};

export default HoldKeyActionBar;
