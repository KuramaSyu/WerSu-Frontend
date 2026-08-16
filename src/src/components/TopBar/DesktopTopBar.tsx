import { Box, Slide } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { M2, M3, M5 } from "../../statics";
import { useLayout } from "../../LayoutProvider";
import { useThemeStore } from "../../zustand/useThemeStore";
import { SearchBar } from "../search/SearchBar";
import { LeftPanelToggle, RightPanelToggle } from "../Panels/LeftPanelToggle";
import { TopBarRightCluster } from "./TopBarRightCluster";

/**
 * Desktop top bar chrome:
 *
 *   - WerSu wordmark (left)
 *   - Centred SearchBar
 *   - :class:`TopBarRightCluster` (slots + bell + avatar + popovers)
 *   - Left/right rail collapse toggles at the far edges
 *
 * Sits in a `Slide` whose visibility is driven by
 * `LayoutProvider.showTopPanel` (the AppShell flips that on scroll).
 *
 * The right cluster is its own subcomponent (`TopBarRightCluster`)
 * so that:
 *
 *   - slot registrations only re-render the cluster, never the
 *     wordmark, search bar or panel toggles here;
 *   - the cluster's anchor state and service-reachability poll only
 *     re-render its subtree;
 *   - `React.memo` on the cluster keeps this top bar's
 *     scroll-driven re-renders from cascading into the cluster.
 *
 * The wordmark click navigates to "/" via `react-router-dom`.
 */
export const DesktopTopBar: React.FC = () => {
  const { showTopPanel } = useLayout();
  const { theme } = useThemeStore();
  const navigate = useNavigate();

  return (
    <Slide
      appear={false}
      direction="down"
      in={showTopPanel}
      timeout={theme.transitions.duration.standard}
      easing={{
        enter: theme.transitions.easing.easeInOut,
        exit: theme.transitions.easing.easeInOut,
      }}
    >
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.appBar,
          display: "flex",
          alignItems: "center",
          gap: M2,
          px: M3,
          height: M5,
          backgroundColor: theme.palette.background.default,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* Far-left: collapse / expand the left rail */}
        <LeftPanelToggle />

        {/* Left cluster: WerSu wordmark (clickable -> /) */}
        <Box
          onClick={() => navigate("/")}
          sx={{
            cursor: "pointer",
            userSelect: "none",
            fontFamily: '"Fira Sans", sans-serif',
            fontWeight: 300,
            fontSize: theme.typography.h4.fontSize,
            color: theme.palette.text.primary,
            whiteSpace: "nowrap",
          }}
        >
          WerSu
        </Box>

        {/* Centre: search bar sits centred between the
            auto-width wordmark (left) and the right cluster.
            The wrapper only takes the search bar's clamped
            width; `margin: auto` pushes the leftover space
            equally to both sides so it always lines up with
            the page centre, regardless of the top panel's
            total width. */}
        <Box sx={{ margin: "auto" }}>
          <SearchBar />
        </Box>

        {/* Right cluster lives in its own component so its
            store reads (slots, reachability, user) and local
            anchors (popovers / user menu) only re-render its
            subtree. See :class:`TopBarRightCluster`. */}
        <TopBarRightCluster />

        {/* Far-right: collapse / expand the right rail */}
        <RightPanelToggle />
      </Box>
    </Slide>
  );
};
