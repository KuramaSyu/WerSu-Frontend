import type { CSSProperties, ReactNode } from "react";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useLayout } from "../../LayoutProvider";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import { M2, RAIL_ELEVATION } from "../../statics";
import { panelIconButtonSx, panelIconSvgSx } from "./panelIconStyles";
import { TranslucentPaper } from "../TranslucentPaper";

export interface LeftRailProps {
  /** Mounted left-rail content (whatever the current route put there). */
  children: ReactNode;
}

// Tabler icons are flex items, so inside the narrow handle button they
// would be squeezed down to the button width. Absolutely positioning
// them keeps the chevron at its full size regardless of the pill size.
const iconOverlayStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  flexShrink: 0,
  pointerEvents: "none",
};

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
      </TranslucentPaper>

      {/* Vertically centred handle on the rail's right border. Only
          mounted when a panel is actually present so it does not
          float over the canvas on routes without a left panel. */}
      {children != null && (
        <Tooltip
          title={leftPanelOpen ? "Collapse left panel" : "Expand left panel"}
          placement="right"
        >
          <IconButton
            onClick={handleToggle}
            size="small"
            aria-label={
              leftPanelOpen ? "Collapse left panel" : "Expand left panel"
            }
            sx={{
              position: "absolute",
              top: "50%",
              right: 0,
              transform: "translate(50%, -50%)",
              zIndex: 3,
              width: "1rem",
              height: "3.25rem",
              minWidth: 0,
              p: 0,
              borderRadius: "0.5rem",
              color: theme.palette.text.secondary,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: theme.shadows[1],
              transition: theme.transitions.create([
                "background-color",
                "color",
              ]),
              "&:hover": {
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            {leftPanelOpen ? (
              <IconChevronLeft
                size={16}
                style={iconOverlayStyle}
              />
            ) : (
              <IconChevronRight
                size={16}
                style={iconOverlayStyle}
              />
            )}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
