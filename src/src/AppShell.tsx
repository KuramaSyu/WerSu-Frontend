import { Box, Stack } from "@mui/material";
import { Outlet } from "react-router-dom";
import { M1, M2, M3, M4, M5 } from "./statics";
import { useLayout } from "./LayoutProvider";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoadingPage } from "./pages/LoadingPage/Main";
import TopBar from "./components/TopBar";
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
    showTopBar,
  } = useLayout();
  const [showSplashScreen, setShowSplashScreen] = useState(false);
  const [exitPercentage, setExitPercentage] = useState(
    Math.round(Math.random() * 100),
  );
  const { theme } = useThemeStore();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  // Mirror the scroll container into a shared store so deep-link handlers and the outline panel can read it without prop-drilling.
  useEffect(() => {
    useScrollElementStore.getState().setElement(scrollElement);
    return () => useScrollElementStore.getState().setElement(null);
  }, [scrollElement]);
  const TOP_BAR_PANEL_DISTANCE = M2;
  const oneOrZero = Math.round(exitPercentage / 100) * 100;

  useEffect(() => {
    const lastShown = sessionStorage.getItem("splashScreenShown");
    const now = Date.now();

    const shouldNow = !lastShown || now - parseInt(lastShown) > 30 * 60 * 1000; // 30 minutes

    if (shouldNow) {
      sessionStorage.setItem("splashScreenShown", now.toString());
      setShowSplashScreen(true);
    }

    const timer = setTimeout(() => {
      setShowSplashScreen(false);
    }, 1200);
  }, []);

  return (
    <>
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
      <TopBar scrollContainer={scrollElement} />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `${leftPanelOpen ? leftPanelSize : "0px"} minmax(0, 1fr) ${rightPanelOpen ? rightPanelSize : "0px"}`,
          transition: `grid-template-columns ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}, padding-top ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}, height ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,
          pt: showTopBar ? `calc(${M5} + ${TOP_BAR_PANEL_DISTANCE})` : "0px",
          height: showTopBar
            ? `calc(100vh - ${M5} - ${TOP_BAR_PANEL_DISTANCE})`
            : "100vh",
          // mx: M3,
          // gap is handled by its inner boxes, so that it can be collapsed without leaving a gap
        }}
      >
        <Box
          sx={{
            overflowY: "auto",
            mb: TOP_BAR_PANEL_DISTANCE,
            // Canvas-side gap so the Paper's box-shadow can render
            // inside the cell without being clipped.
            pr: M3,
          }}
        >
          {leftPanel}
        </Box>

        <Box
          aria-label="Main content"
          ref={setScrollElement}
          sx={{
            overflowY: "auto", // make it scrollable
            display: "block",
            scrollbarWidth: "none",
            px: M2,
            pb: M2,
          }}
        >
          <Stack direction={"column"} sx={{ position: "relative" }}>
            <Outlet />
            <Box
              sx={{
                width: "100%",
                height: "20vh",
                background: theme.palette.background.default,
              }}
            ></Box>
          </Stack>
        </Box>
        <Box
          sx={{
            overflowY: "auto",
            mb: TOP_BAR_PANEL_DISTANCE,
            // to not clip shadows
            pl: M3,
          }}
        >
          {rightPanel}
        </Box>
      </Box>
    </>
  );
};
