import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { M2, MOBILE_DRAWER_WIDTH } from "../../statics";
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
  const {
    rightPanelSize,
    rightPanelOpen,
    setRightPanelOpen,
    setRightPanelUserOverride,
  } = useLayout();

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
          }}
        >
          <Box
            sx={{
              flex: 1,
              alignSelf: "flex-start",
              // The content box is given the rail's width plus horizontal
              // padding. Without `border-box` (the app has no global reset)
              // that padding is added on top, so the box overflows the rail
              // by 1rem and the right padding gets clipped away.
              boxSizing: "border-box",
              width: isMobile ? "100%" : rightPanelSize,
              minWidth: isMobile ? 0 : rightPanelSize,
              overflowY: "auto",
              minHeight: 0,
              px: M2,
              pb: M2,
            }}
          >
            {children}
          </Box>
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
