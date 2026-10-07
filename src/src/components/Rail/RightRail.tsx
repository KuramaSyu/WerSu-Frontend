import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import { M2, TOP_BAR_ELEVATION } from "../../statics";
import { TranslucentPaper } from "../TranslucentPaper";

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
    <TranslucentPaper
      elevation={TOP_BAR_ELEVATION}
      square
      sx={{
        display: "flex",
        flexDirection: "column",
        // The right rail's own paper-tinted shell sits on top of
        // the parent's paper-toned canvas; both are translucent so
        // the AppBackground still shows through.
        backgroundColor: theme.palette.background.default,
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
    </TranslucentPaper>
  );
};
