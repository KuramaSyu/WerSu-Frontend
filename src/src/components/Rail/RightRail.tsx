import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { M2 } from "../../statics";

export interface RightRailProps {
  /** Mounted right-rail content (whatever the current route put there). */
  children: ReactNode;
}

/**
 * Right side rail. Just renders the route's right panel content; the
 * collapse / expand toggle lives in the AppShell's top panel
 * (`<RightPanelToggle />`).
 *
 * The rail paints no surface of its own. Unlike the left rail (a
 * separate grid column that has to paint its own canvas), the right
 * rail lives inside the main `TranslucentPaper`, so staying transparent
 * makes it share the exact same background as the main content. Each
 * section provides its own thin outline instead of a rail-wide fill.
 *
 * Width is driven entirely by the parent grid track (AppShell's
 * `grid-template-columns`); this component does not animate its own
 * width.
 */
export const RightRail: React.FC<RightRailProps> = ({ children }) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        minWidth: 0,
        zIndex: 1,
      }}
    >
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
          px: M2,
          pb: M2,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
