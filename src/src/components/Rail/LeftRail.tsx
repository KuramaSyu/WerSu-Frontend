import type { ReactNode } from "react";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useLayout } from "../../LayoutProvider";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import { M2, RAIL_ELEVATION } from "../../statics";
import { panelIconButtonSx, panelIconSvgSx } from "./panelIconStyles";
import { TranslucentPaper } from "../TranslucentPaper";
import { PanelEdgeHandle } from "../Panels/PanelEdgeHandle";

/**
 * Opacity of everything painted inside the rail while the pointer is
 * elsewhere. Blending the whole subtree toward the surface behind it
 * mutes every colour (text, icons, chips, cards) in one place, in both
 * light and dark themes, without turning into a hard grey.
 */
const RAIL_INACTIVE_OPACITY = 0.55;

export interface LeftRailProps {
  /** Mounted left-rail content (whatever the current route put there). */
  children: ReactNode;
}

/**
 * Owns the entire left side rail:
 *
 *   - Search shortcut icon when collapsed.
 *   - Scrolling content area when open.
 *   - A small collapse / expand handle centred on its right border.
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
  const {
    leftPanelOpen,
    setLeftPanelOpen,
    setLeftPanelUserOverride,
  } = useLayout();
  const { theme } = useThemeStore();

  const isCollapsed = !leftPanelOpen;

  // In-context second way to collapse / expand the rail, floating on
  // the right border. This is purely additive: the top-bar
  // `<LeftPanelToggle />` keeps working exactly as before, and this
  // handle marks the user override the same way.
  const handleToggle = () => {
    setLeftPanelOpen(!leftPanelOpen);
    setLeftPanelUserOverride(true);
  };

  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        zIndex: 2,
      }}
    >
      <TranslucentPaper
        elevation={RAIL_ELEVATION}
        square
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: theme.palette.background.default,
          overflow: "hidden",
          minWidth: 0,
          zIndex: 1,
          borderRight: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* Every colour inside the rail is muted until the pointer is
            over it. This wrapper fades the content toward the rail's
            own surface -- `backgroundColor` is painted on the
            `TranslucentPaper` above, so it keeps its colour and only
            the content loses luminance. */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            minWidth: 0,
            opacity: RAIL_INACTIVE_OPACITY,
            transition: theme.transitions.create("opacity"),
            "&:hover": { opacity: 1 },
          }}
        >
          {isCollapsed ? (
            // Collapsed rail: just the search shortcut so Ctrl+K
            // stays reachable even when the top panel is hidden. The
            // expand toggle lives in the top bar (`<LeftPanelToggle />`)
            // and in the edge handle below.
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

          {/* Keep the panel content mounted while the rail is collapsed.
              Unmounting it here made expanding rebuild the whole subtree
              (directory hierarchy, table of contents, attachments…) in the
              same frame as the shell's grid transition, which blocked the
              main thread for hundreds of ms on the note page. `display:
              none` keeps the React tree alive without taking up space. */}
          <Box
            sx={{
              display: isCollapsed ? "none" : "flex",
              flexDirection: "column",
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
        </Box>
      </TranslucentPaper>

      {/* Vertically centred handle on the rail's right border. Only
          mounted when a panel is actually present so it does not
          float over the canvas on routes without a left panel. */}
      {children != null && (
        <PanelEdgeHandle
          side="left"
          open={leftPanelOpen}
          onClick={handleToggle}
          collapseTitle="Collapse left panel"
          expandTitle="Expand left panel"
          centerInViewport
        />
      )}
    </Box>
  );
};
