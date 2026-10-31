import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { M2 } from "../../statics";
import { useLayout } from "../../LayoutProvider";
import { PanelEdgeHandle } from "../Panels/PanelEdgeHandle";

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

  return (
    <Box
      sx={{
        position: "relative",
        width,
        height: "100%",
        flexShrink: 0,
        transition: theme.transitions.create("width"),
        zIndex: 2,
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
            width: rightPanelSize,
            minWidth: rightPanelSize,
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
      {children != null && !rightPanelOpen && (
        <PanelEdgeHandle
          side="right"
          open={false}
          onClick={handleToggle}
          collapseTitle="Collapse all boxes"
          expandTitle="Expand right panel"
        />
      )}
    </Box>
  );
};
