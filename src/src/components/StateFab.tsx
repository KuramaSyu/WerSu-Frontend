// Reusable "stateful" FAB.
//
// A FAB that knows about one or more states, each described by an
// `icon` and a `text` label. It always shows the active state's icon.
// On mount and whenever the active state changes, it briefly expands
// into a rounded-rect (via MUI `Collapse`) to spell out the active
// state's text, then collapses back to a fully round icon-only FAB.
//
// The micro-interaction makes state indicators unambiguous: an eye
// with "Viewing" reads as "you are viewing now", not "tap to view".
//
// Reuse it anywhere a toggle needs to explain its current state.

import React, { useEffect, useState } from "react";
import { Box, Collapse, Fab, Typography } from "@mui/material";
import type { FabProps } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";

export interface StateFabState {
  /** Unique key identifying this state. */
  key: string;
  /** Icon shown for this state (and whenever the FAB is collapsed). */
  icon: React.ReactNode;
  /** Label revealed by the expand micro-interaction. */
  text: string;
}

export interface StateFabProps
  extends Omit<FabProps, "children" | "variant" | "size"> {
  /** All states the FAB can be in. */
  states: StateFabState[];
  /** Key of the currently active state. */
  activeKey: string;
  /** How long the active state's text stays visible before collapsing. */
  labelDurationMs?: number;
  /** Corner radius (px) while the label is expanded. */
  expandedRadius?: number;
  /** Diameter (px) of the round icon-only FAB. */
  buttonSize?: number;
  /** Gap between the icon and the text while expanded, in theme spacing. */
  iconGap?: number;
  /** Keep the label expanded while the pointer rests on the FAB. */
  expandOnHover?: boolean;
}

const DEFAULT_DURATION_MS = 3_000;
const DEFAULT_EXPANDED_RADIUS = 16;
const DEFAULT_SIZE = 56;
const DEFAULT_ICON_GAP = 2;

export const StateFab = React.forwardRef<HTMLButtonElement, StateFabProps>(
  function StateFab(
    {
      states,
      activeKey,
      labelDurationMs = DEFAULT_DURATION_MS,
      expandedRadius = DEFAULT_EXPANDED_RADIUS,
      buttonSize = DEFAULT_SIZE,
      iconGap = DEFAULT_ICON_GAP,
      expandOnHover = false,
      onClick,
      onMouseEnter,
      onMouseLeave,
      sx,
      ...fabProps
    },
    ref,
  ) {
    const { theme } = useThemeStore();
    const active =
      states.find((state) => state.key === activeKey) ?? states[0];

    // `expanded` drives the width/label; `shownKey` tracks which state's
    // micro-interaction is playing so a state change re-opens the label.
    const [expanded, setExpanded] = useState(true);
    const [hovered, setHovered] = useState(false);
    const [shownKey, setShownKey] = useState(activeKey);
    if (shownKey !== activeKey) {
      // Render-phase state adjustment (React's recommended pattern for
      // derived state) so the effect below only owns the timer.
      setShownKey(activeKey);
      setExpanded(true);
    }

    useEffect(() => {
      const timer = window.setTimeout(
        () => setExpanded(false),
        labelDurationMs,
      );
      return () => window.clearTimeout(timer);
    }, [shownKey, labelDurationMs]);

    if (!active) {
      return null;
    }

    // Hover can hold the label open past the auto-collapse timer.
    const showLabel = expanded || (expandOnHover && hovered);

    const roundRadius = buttonSize / 2;
    const radius = showLabel ? expandedRadius : roundRadius;
    const morphTransition = theme.transitions.create(
      ["border-radius", "padding", "background-color", "box-shadow"],
      { duration: theme.transitions.duration.complex },
    );

    return (
      <Fab
        {...fabProps}
        ref={ref}
        onClick={onClick}
        onMouseEnter={(event) => {
          if (expandOnHover) setHovered(true);
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          if (expandOnHover) setHovered(false);
          onMouseLeave?.(event);
        }}
        sx={[
          {
            // `width: auto` lets the FAB track the animating `Collapse`,
            // so the size change animates for free.
            width: "auto",
            minWidth: buttonSize,
            height: buttonSize,
            minHeight: buttonSize,
            py: 0,
            px: showLabel ? theme.spacing(2) : 0,
            overflow: "hidden",
            transition: morphTransition,
            // `&&` outranks the theme's global `borderRadius: 50%` FAB
            // override and any `&:hover` the caller adds in `sx`.
            "&&": { borderRadius: `${radius}px` },
            "&&:hover": { borderRadius: `${radius}px` },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <Box
          component="span"
          sx={{ display: "inline-flex", alignItems: "center" }}
        >
          {active.icon}
          <Collapse
            in={showLabel}
            appear
            orientation="horizontal"
            timeout={theme.transitions.duration.complex}
            unmountOnExit
          >
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                pl: iconGap,
              }}
            >
              <Typography
                component="span"
                sx={{
                  whiteSpace: "nowrap",
                  fontFamily: theme.typography.fontFamily,
                  // Thin label: Fira Sans 300 is not loaded, so 400 is the
                  // lightest real weight.
                  fontWeight: theme.typography.fontWeightRegular,
                }}
              >
                {active.text}
              </Typography>
            </Box>
          </Collapse>
        </Box>
      </Fab>
    );
  },
);

export default StateFab;
