import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Fade,
  IconButton,
  useTheme,
  type IconButtonProps,
} from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";

/**
 * An IconButton that briefly swaps its icon for a caller-provided
 * `microInteraction` element, then animates back to the resting icon.
 *
 * Typical use: copy-to-clipboard.
 *
 * Props:
 *   - `icon`:       the resting ReactNode (e.g. <ContentCopyIcon />).
 *   - `microInteraction`: shown in place of `icon` for `microDurationMs`.
 *   - `microDurationMs`:   how long the micro-interaction stays visible
 *                          before fading back. Default: 1000.
 *   - `onTrigger`:  optional callback fired when the button is clicked.
 *                   Return a Promise if you want the micro-interaction
 *                   to wait for an async action (e.g. clipboard write)
 *                   before timing out.
 *   - All other props are forwarded to MUI's `IconButton`.
 */
export interface MicroInteractionButtonProps extends Omit<
  IconButtonProps,
  "onClick"
> {
  icon: React.ReactNode;
  microInteraction: React.ReactNode;
  microDurationMs?: number;
  onTrigger?: () => void | Promise<void>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export const MicroInteractionButton: React.FC<MicroInteractionButtonProps> = ({
  icon,
  microInteraction,
  microDurationMs = 1000,
  onTrigger,
  onClick,
  disabled,
  ...iconButtonProps
}) => {
  // Use the project's "richer animation" duration so the crossfade
  // matches other surfaces (e.g. `Main.tsx` uses `complex` for exits).
  const theme = useThemeStore((s) => s.theme);
  const fadeDuration = theme.transitions.duration.standard;
  const [active, setActive] = useState(false);
  // Track the timer + in-flight async so we don't reset twice when
  // the user double-clicks rapidly.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // Ignore extra clicks while the micro-interaction is still playing
    // or while an async onTrigger is in flight.
    if (active || busyRef.current || disabled) return;

    busyRef.current = true;
    setActive(true);

    try {
      await onTrigger?.();
    } finally {
      busyRef.current = false;
    }

    clearTimer();
    timerRef.current = setTimeout(() => {
      setActive(false);
      timerRef.current = null;
    }, microDurationMs);

    onClick?.(event);
  };

  return (
    <IconButton {...iconButtonProps} disabled={disabled} onClick={handleClick}>
      {/*
        Crossfade between the resting icon and the micro-interaction.
        Both are layered in the same 1em square via MUI's `Fade` so the
        layout never reflows when they swap. The duration comes from
        the theme's "complex" token so it matches the rest of the app.
      */}
      <Box
        sx={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "1em",
          height: "1em",
        }}
      >
        <Fade in={!active} timeout={fadeDuration} unmountOnExit={false}>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </Box>
        </Fade>
        <Fade in={active} timeout={fadeDuration} unmountOnExit={false}>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {microInteraction}
          </Box>
        </Fade>
      </Box>
    </IconButton>
  );
};

export default MicroInteractionButton;
