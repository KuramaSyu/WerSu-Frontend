import type { ReactNode } from "react";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useLayout } from "../../LayoutProvider";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { M1, M2, M5 } from "../../statics";
import { panelIconButtonSx, panelIconSvgSx } from "./panelIconStyles";

export interface LeftRailProps {
  /** Mounted left-rail content (whatever the current route put there). */
  children: ReactNode;
}

/**
 * Owns the entire left side rail:
 *
 *   - Search shortcut icon when collapsed.
 *   - Scrolling content area when open.
 *
 * The WerSu wordmark, search bar, notifications bell, avatar, and
 * the panel show / hide toggles live in the AppShell's top panel
 * (which paints `background.default` to match the rail). This
 * component is just the column under it.
 *
 * The rail background is `background.default`; the rail's `Paper`
 * content (e.g. `UpperPanel`) is responsible for its own surface and
 * elevation.
 *
 * Width is driven entirely by the parent grid track (AppShell's
 * `grid-template-columns`); this component does not animate its own
 * width.
 */
export const LeftRail: React.FC<LeftRailProps> = ({ children }) => {
  const { leftPanelOpen, showTopPanel } = useLayout();
  const { theme } = useThemeStore();
  const { isMobile } = useBreakpoint();

  const isCollapsed = !leftPanelOpen;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.palette.background.default,
        height: "100vh",
        // When the top panel hides, the rail extends upward to
        // fill the freed space. Mobile has no top panel, so the
        // rail anchors at the top of the viewport.
        marginTop: isMobile ? 0 : showTopPanel ? M5 : 0,
        transition: theme.transitions.create("margin-top", {
          duration: theme.transitions.duration.standard,
          easing: theme.transitions.easing.easeInOut,
        }),
        overflow: "hidden",
        minWidth: 0,
        borderRight: `1px solid ${theme.palette.divider}`,
      }}
    >
      {isCollapsed ? (
        // Collapsed rail: just the search shortcut so Ctrl+K
        // stays reachable even when the top panel is hidden. The
        // expand toggle lives in the top bar (`<LeftPanelToggle />`).
        <Stack spacing={0.5} sx={{ pt: 0.5, alignItems: "center" }}>
          <Tooltip title="Search (Ctrl+K)">
            <IconButton
              onClick={() =>
                useSearchNotesStore.getState().setIsDialogOpen(true)
              }
              sx={panelIconButtonSx}
            >
              <SearchIcon sx={panelIconSvgSx} />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : null}

      {!isCollapsed && (
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            minHeight: 0,
            px: M2,
            pb: M2,
            scrollbarWidth: "thin",
            scrollbarColor: `transparent transparent`,
            "&:hover": {
              scrollbarColor: `${theme.palette.secondary.dark} transparent`,
            },
            transition: theme.transitions.create(),
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
};
