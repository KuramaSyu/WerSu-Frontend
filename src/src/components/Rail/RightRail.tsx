import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Box, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { M3, MOBILE_DRAWER_WIDTH } from "../../statics";
import { useLayout } from "../../LayoutProvider";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { PanelEdgeHandle } from "../Panels/PanelEdgeHandle";
import { MobileDrawerBackdrop } from "../Panels/MobileDrawerBackdrop";

export interface RightRailProps {
  /** Mounted right-rail content (whatever the current route put there). */
  children: ReactNode;
  /**
   * Animated width of the rail. AppShell drives this from the layout
   * state (open size or `0px`); the rail owns the transition so closing
   * is a plain width animation instead of a nested grid-track change.
   */
  width: string;
}

/**
 * Right side rail. Renders the route's right panel content; the
 * collapse / expand toggle lives in the AppShell's top panel
 * (`<RightPanelToggle />`) plus the in-context handles below.
 *
 * The rail paints no surface of its own. Unlike the left rail (a
 * separate grid column that has to paint its own canvas), the right
 * rail lives inside the main `TranslucentPaper`, so staying transparent
 * makes it share the exact same background as the main content. Each
 * section provides its own thin outline instead of a rail-wide fill.
 *
 * Two handles cooperate:
 *   - While open, the first section hosts a handle on its left border
 *     (see `PanelSection`'s `leftEdgeHandle`), right where the boxes
 *     are.
 *   - While collapsed that content is clipped away, so this rail keeps
 *     its own handle on the outer border (mirroring the left rail) so
 *     the panel can be reopened.
 *
 * The content is pinned to the open width and clipped by the rail, so
 * opening / closing reads as the panel sliding in and out rather than
 * every box resizing (and the handle bouncing) mid-transition.
 */
export const RightRail: React.FC<RightRailProps> = ({ children, width }) => {
  const theme = useTheme();
  const { isMobile } = useBreakpoint();
  const { rightPanelOpen, setRightPanelOpen, setRightPanelUserOverride } =
    useLayout();

  const handleToggle = () => {
    setRightPanelOpen(!rightPanelOpen);
    setRightPanelUserOverride(true);
  };

  if (isMobile && children === null) {
    return null;
  }

  const content = (
    <>
      <MobileDrawerBackdrop
        open={isMobile && rightPanelOpen}
        onClose={() => setRightPanelOpen(false)}
      />
      <Box
        aria-label="Right Rail"
        sx={{
          // Mobile: slide in from the right as an overlay drawer.
          // Desktop: the in-flow column with an animated width.
          position: isMobile ? "fixed" : "relative",
          top: isMobile ? 0 : undefined,
          right: isMobile ? 0 : undefined,
          bottom: isMobile ? 0 : undefined,
          width: isMobile ? MOBILE_DRAWER_WIDTH : width,
          height: "100%",
          flexShrink: 0,
          transform: isMobile
            ? `translateX(${rightPanelOpen ? "0" : "100%"})`
            : undefined,
          transition: isMobile
            ? theme.transitions.create("transform", {
                duration: theme.transitions.duration.standard,
                easing: theme.transitions.easing.easeInOut,
              })
            : theme.transitions.create("width"),
          zIndex: isMobile ? (t) => t.zIndex.appBar + 1 : 2,
          boxShadow: isMobile && rightPanelOpen ? theme.shadows[8] : undefined,
          // The rail is normally transparent over the main paper; as a
          // drawer it needs its own opaque surface.
          backgroundColor: isMobile
            ? theme.palette.background.default
            : undefined,
          borderLeft: isMobile
            ? `1px solid ${theme.palette.divider}`
            : undefined,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
            minWidth: 0,
            // Inner right gutter. Kept off the outer flex box because
            // that box is sized to the rail width: padding on it would
            // add to `width` (no global border-box), stealing the gutter
            // from the outlet even when the rail is collapsed to `0px`.
            pr: M3,
          }}
        >
          <Stack spacing={2}>{children}</Stack>
        </Box>

        {/* Collapsed-only expand handle. Mirrors the left rail so the
          panel stays reopenable once its content is clipped away. */}
        {!isMobile && children != null && !rightPanelOpen && (
          <PanelEdgeHandle
            side="right"
            open={false}
            onClick={handleToggle}
            collapseTitle="Collapse all boxes"
            expandTitle="Expand right panel"
          />
        )}
      </Box>
    </>
  );

  // Mobile: the rail is an overlay drawer. Portal it to the body so it
  // is not trapped inside the main wrapper's `z-index: 0` stacking
  // context (needed to paint above `AppBackground`); at the root its
  // own z-index can sit above the bottom bar and the left drawer.
  if (isMobile && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }

  return content;
};
