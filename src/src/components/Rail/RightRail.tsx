import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import { M2 } from "../../statics";

export interface RightRailProps {
  /** Mounted right-rail content (whatever the current route put there). */
  children: ReactNode;
}

/**
 * Right side rail. Just renders the route's right panel content;
 * the collapse / expand toggle lives in the AppShell's top panel
 * (`<RightPanelToggle />`).
 *
 * Width is driven entirely by the parent grid track (AppShell's
 * `grid-template-columns`); this component does not animate its own
 * width.
 */
export const RightRail: React.FC<RightRailProps> = ({ children }) => {
  const { theme } = useThemeStore();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        // Transparent so the right rail blends into the parent
        // wrapper's paper-toned canvas. Section content paints its
        // own outlined boxes on top via the rail's children
        // (`UpperPanel variant="outlined"`).
        backgroundColor: "transparent",
        height: "100%",
        overflow: "hidden",
        minWidth: 0,
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
