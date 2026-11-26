// Reusable "stateful" FAB.
//
// A FAB that knows about one or more states, each described by an
// `icon` and a `text` label. It always shows the active state's icon.
// On mount and whenever the active state changes, it briefly expands
// into a rounded-rect to spell out the active state's text, then
// collapses back to a fully round icon-only FAB. The label width is
// measured and animated so changing states ("Save" -> "Saving" ->
// "Saved now") morphs smoothly instead of snapping to the new width.
//
// The micro-interaction makes state indicators unambiguous: an eye
// with "Viewing" reads as "you are viewing now", not "tap to view".
//
// Reuse it anywhere a toggle needs to explain its current state.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Fab, Typography } from "@mui/material";
import type { FabProps } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";

export interface StateFabState {
  /** Unique key identifying this state. */
  key: string;
  /** Icon shown for this state (and whenever the FAB is collapsed). */
  icon: React.ReactNode;
  /** Label revealed by the expand micro-interaction. */
  text: string;
  /**
   * Enter this state with the label collapsed: no pulse on the state
   * change. Hover still reveals the label. Use it for quiet idle
   * states that should not shout each time they become active.
   */
  startCollapsed?: boolean;
}

export interface StateFabProps extends Omit<
  FabProps,
  "children" | "variant" | "size"
> {
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
  /**
   * Mount with the label collapsed instead of expanded. Later state
   * changes still pulse the label unless the state itself sets
   * `startCollapsed`. Use it for controls whose idle state shouldn't
   * shout on page load.
   */
  startCollapsed?: boolean;
  /**
   * State keys that trigger the automatic label pulse on mount / state
   * change. Defaults to every state, preserving the original FAB
   * behaviour. Pass a narrower list for controls whose "idle" state
   * should only explain itself on hover.
   */
  expandKeys?: string[];
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
      startCollapsed = false,
      expandKeys,
      onClick,
      onMouseEnter,
      onMouseLeave,
      sx,
      ...fabProps
    },
    ref,
  ) {
    const { theme } = useThemeStore();
    const active = states.find((state) => state.key === activeKey) ?? states[0];
    const autoExpand =
      !active?.startCollapsed &&
      (expandKeys === undefined || expandKeys.includes(activeKey));

    // `expanded` drives the width/label; `shownKey` tracks which state's
    // micro-interaction is playing so a state change re-opens the label.
    const [expanded, setExpanded] = useState(autoExpand && !startCollapsed);
    const [hovered, setHovered] = useState(false);
    const [shownKey, setShownKey] = useState(activeKey);
    const labelContentRef = useRef<HTMLSpanElement>(null);
    const [labelWidth, setLabelWidth] = useState(0);
    if (shownKey !== activeKey) {
      // Render-phase state adjustment (React's recommended pattern for
      // derived state) so the effect below only owns the timer.
      setShownKey(activeKey);
      setExpanded(autoExpand);
    }

    useEffect(() => {
      const timer = window.setTimeout(
        () => setExpanded(false),
        labelDurationMs,
      );
      return () => window.clearTimeout(timer);
    }, [shownKey, labelDurationMs]);

    // Measure the rendered label so a text/state change can animate the
    // width from the previous label to the new one. The content stays
    // laid out at its intrinsic width even while the outer clip is 0.
    useLayoutEffect(() => {
      const width = labelContentRef.current?.scrollWidth ?? 0;
      if (width > 0) setLabelWidth(width);
    }, [active?.text, iconGap]);

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
          <Box
            component="span"
            aria-hidden={!showLabel}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              overflow: "hidden",
              width: showLabel ? labelWidth : 0,
              transition: theme.transitions.create("width", {
                duration: theme.transitions.duration.complex,
                easing: theme.transitions.easing.easeInOut,
              }),
            }}
          >
            <Box
              component="span"
              ref={labelContentRef}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                flexShrink: 0,
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
          </Box>
        </Box>
      </Fab>
    );
  },
);

export default StateFab;
