import { Box, Stack } from "@mui/material";
import { Outlet } from "react-router-dom";
import {
  COLLAPSED_PANEL_SIZE,
  M2,
  M5,
  MOBILE_BOTTOM_BAR_CLEARANCE,
} from "./statics";
import { useLayout } from "./LayoutProvider";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoadingPage } from "./pages/LoadingPage/Main";
import { LeftRail } from "./components/Rail/LeftRail";
import { RightRail } from "./components/Rail/RightRail";
import { TopBar } from "./components/TopBar/TopBar";
import { useBreakpoint } from "./hooks/useBreakpoint";
import { useTopPanelScrollVisibility } from "./components/Rail/useTopPanelScrollVisibility";
import { useThemeStore } from "./zustand/useThemeStore";
import { useScrollElementStore } from "./zustand/outlineStore";

export const AppShell: React.FC = () => {
  const {
    leftPanel,
    rightPanel,
    leftPanelOpen,
    rightPanelOpen,
    leftPanelSize,
    rightPanelSize,
    showTopPanel,
    setShowTopPanel,
  } = useLayout();
  const [showSplashScreen, setShowSplashScreen] = useState(false);
  const [exitPercentage, setExitPercentage] = useState(
    Math.round(Math.random() * 100),
  );
  const { theme } = useThemeStore();
  const { isMobile } = useBreakpoint();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );

  // Mirror the scroll container into a shared store so deep-link
  // handlers and the outline panel can read it without prop-drilling.
  useEffect(() => {
    useScrollElementStore.getState().setElement(scrollElement);
    return () => useScrollElementStore.getState().setElement(null);
  }, [scrollElement]);

  // Hide-on-scroll for the top panel, sourced from the main contents box
  useTopPanelScrollVisibility(scrollElement, setShowTopPanel);

  // splash screen starts from a random direction because i like it
  const oneOrZero = Math.round(exitPercentage / 100) * 100;

  // show spashscreen once per 10 minutes
  useEffect(() => {
    const lastShown = sessionStorage.getItem("splashScreenShown");
    const now = Date.now();

    const shouldNow = !lastShown || now - parseInt(lastShown) > 10 * 60 * 1000; // 10 minutes

    if (shouldNow) {
      sessionStorage.setItem("splashScreenShown", now.toString());
      setShowSplashScreen(true);
    }

    const timer = setTimeout(() => {
      setShowSplashScreen(false);
    }, 1200);
  }, []);

  // A panel whose content is `null` is not mounted at all -> its grid
  // track collapses to 0px so it never takes space. A mounted panel
  // either renders at its full width or at the icon-only collapsed
  // width (so the collapse toggle stays reachable).
  const leftColumnWidth =
    leftPanel !== null
      ? leftPanelOpen
        ? leftPanelSize
        : COLLAPSED_PANEL_SIZE
      : "0px";
  const rightColumnWidth =
    rightPanel !== null
      ? rightPanelOpen
        ? rightPanelSize
        : COLLAPSED_PANEL_SIZE
      : "0px";

  return (
    <>
      <Box
        sx={{
          width: "100vw",
          height: "100vh",
          backgroundColor: theme.palette.background.default,
        }}
      >
        <AnimatePresence initial={false}>
          {showSplashScreen && (
            <motion.div
              initial={false}
              animate={{ clipPath: "circle(100% at 50% 50%)" }}
              exit={{
                clipPath: oneOrZero
                  ? `circle(0% at 100% ${exitPercentage}%)`
                  : `circle(0% at ${exitPercentage}% 100%)`,
                opacity: 0.2,
              }}
              transition={{
                duration: 1,
                ease: [0.4, 0, 0.2, 1],
              }}
              style={{
                position: "fixed",
                zIndex: 9999,
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
              }}
            >
              <LoadingPage></LoadingPage>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top panel chrome (sibling of the grid). Lives in its
            own component (`TopBar`) which picks the desktop top
            bar vs the mobile bottom bar from the current
            breakpoint. The desktop variant animates the chrome
            up off-screen via `Slide` driven by
            `showTopPanel`; the mobile variant pins to the
            bottom and stays visible. The grid below extends
            upward (`marginTop` transition) when the top bar
            hides so the canvas stays continuous. */}
        <TopBar />

        <Box
          sx={{
            display: "grid",
            // Two-column layout: left rail (default-toned canvas)
            // | main+right wrapper (paper-toned, fixed-size card).
            // The wrapper owns its own background, so the main
            // content + right rail scroll surface is always paper
            // -- no transparent leak through to the wrapper's
            // `default` canvas during scroll.
            gridTemplateColumns: `${leftColumnWidth} minmax(0, 1fr)`,
            transition: `grid-template-columns ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,
            height: "100vh",
          }}
        >
          <LeftRail>{leftPanel}</LeftRail>

          {/* Main + right rail wrapper: paper-toned, fixed-size,
              extends upward when the top bar hides (marginTop
              transition). Scrolling happens inside this container
              only. On mobile there is no top bar, so the wrapper
              is anchored to the top; the bottom bar floats over
              the canvas and the main scroll container reserves
              bottom space so content never sits under it. */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `minmax(0, 1fr) ${rightColumnWidth}`,
              transition: `grid-template-columns ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}, margin-top ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,
              backgroundColor: theme.palette.background.paper,
              marginTop: isMobile ? 0 : showTopPanel ? M5 : 0,
              // `overflow: hidden` keeps sub-pixel rounding from
              // leaking a horizontal scrollbar during the
              // marginTop transition.
              overflow: "hidden",
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <Box
              aria-label="Main content"
              ref={setScrollElement}
              sx={{
                overflowY: "auto",
                display: "block",
                scrollbarWidth: "none",
                backgroundColor: "transparent",
                p: M2,
                // Mobile: the bottom bar is `position: fixed`,
                // so it floats over the canvas. Pad the scroll
                // container by the bar's height + safe-area so
                // the last row of content stays above it. The
                // clearance comes from
                // `MOBILE_BOTTOM_BAR_CLEARANCE` so the FAB /
                // speed-dial `bottom` values line up.
                paddingBottom: isMobile
                  ? `calc(env(safe-area-inset-bottom, 0px) + ${MOBILE_BOTTOM_BAR_CLEARANCE})`
                  : M2,
                minHeight: 0,
              }}
            >
              <Stack
                direction={"column"}
                sx={{ position: "relative", flex: 1 }}
              >
                <Outlet />
                <Box
                  sx={{
                    width: "100%",
                    height: "20vh",
                  }}
                ></Box>
              </Stack>
            </Box>

            <RightRail>{rightPanel}</RightRail>
          </Box>
        </Box>
      </Box>
    </>
  );
};
