import { Box, Divider, Slide, Stack, alpha } from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  M2,
  M3,
  TOP_BAR_ELEVATION,
  TOP_BAR_HEIGHT,
} from "../../statics";
import { useLayout } from "../../LayoutProvider";
import { useThemeStore } from "../../zustand/useThemeStore";
import { SearchBar } from "../search/SearchBar";
import { ShelfMenu } from "./ShelfMenu";
import { TopBarRightCluster } from "./TopBarRightCluster";
import { TranslucentPaper } from "../TranslucentPaper";
import { Logo } from "../logo";

/**
 * Desktop top bar chrome:
 *
 *   - WerSu wordmark (left)
 *   - Centred SearchBar
 *   - :class:`TopBarRightCluster` (slots + bell + avatar + popovers)
 *
 * Sits in a `Slide` whose visibility is driven by
 * `LayoutProvider.showTopPanel` (the AppShell flips that on scroll).
 *
 * The right cluster is its own subcomponent (`TopBarRightCluster`)
 * so that:
 *
 *   - slot registrations only re-render the cluster, never the
 *     wordmark or search bar here;
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
      <TranslucentPaper
        elevation={TOP_BAR_ELEVATION}
        square
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
          height: TOP_BAR_HEIGHT,
          backgroundColor: theme.palette.background.default,
          borderBottom: `1px solid ${theme.palette.divider}`,
          // The bar is translucent over the theme image. Hint the browser
          // to keep it on the compositor while Slide moves it vertically,
          // instead of re-blending / repainting it every frame.
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      >
        {/* Left cluster: WerSu wordmark (clickable -> /) and
            the shelf selector that lives next to it. Both live
            in a horizontal Stack so a long shelf name can push
            rightward without wrapping the wordmark onto a new
            line; the wordmark itself stays fixed-width via
            `flexShrink: 0`. */}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", flexShrink: 0 }}
        >
          <Stack
            direction="row"
            spacing={1}
            onClick={() => navigate("/")}
            sx={{
              alignItems: "center",
              cursor: "pointer",
              userSelect: "none",
              borderRadius: 1.5,
              px: 0.75,
              py: 0.5,
              transition: (t) =>
                t.transitions.create("background-color", {
                  duration: t.transitions.duration.shortest,
                }),
              "&:hover": {
                backgroundColor: (t) =>
                  alpha(
                    t.palette.primary.main,
                    t.palette.mode === "dark" ? 0.08 : 0.05,
                  ),
              },
            }}
          >
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: 1.5,
                backgroundColor: (t) =>
                  alpha(
                    t.palette.primary.main,
                    t.palette.mode === "dark" ? 0.14 : 0.09,
                  ),
              }}
            >
              <Logo
                size={24}
                monochrome
                title={null}
                style={{ color: theme.palette.primary.main }}
              />
            </Box>
            <Box
              sx={{
                fontFamily: '"Fira Sans", sans-serif',
                fontWeight: 600,
                fontSize: theme.typography.h5.fontSize,
                letterSpacing: "0.01em",
                color: theme.palette.text.primary,
                whiteSpace: "nowrap",
              }}
            >
              WerSu
            </Box>
          </Stack>
          <Divider orientation="vertical" flexItem sx={{ my: 1, opacity: 0.6 }} />
          <ShelfMenu />
        </Stack>

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
      </TranslucentPaper>
    </Slide>
  );
};
