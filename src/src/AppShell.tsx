import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import { M1, M2, M3, M4, M5 } from "./statics";
import { useLayout } from "./LayoutProvider";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUser } from "./api/queries/useUser";
import { LoadingPage } from "./pages/LoadingPage/Main";
import TopBar from "./components/TopBar";
import { useThemeStore } from "./zustand/useThemeStore";

export const AppShell: React.FC = () => {
  const { leftPanel, rightPanel, leftPanelOpen, rightPanelOpen, showTopBar } =
    useLayout();
  const [showSplashScreen, setShowSplashScreen] = useState(false);
  const [exitPercentage, setExitPercentage] = useState(
    Math.round(Math.random() * 100),
  );
  const { theme } = useThemeStore();
  const { data: user } = useUser();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
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
          gridTemplateColumns: `${leftPanelOpen ? "280px" : "0px"} 1fr ${rightPanelOpen ? "280px" : "0px"}`,
          transition: `grid-template-columns ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,
          height: "100vh",
          mx: M3,
          // gap is handled by its inner boxes, so that it can be collapsed without leaving a gap
        }}
      >
        <Box
          sx={{
            overflowY: "auto",
            mt: showTopBar ? `calc(${M3} + ${M5} + ${M3})` : "0px",
            transition: `margin-top ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,
            mr: M3,
          }}
        >
          {leftPanel}
        </Box>

        <Box
          ref={setScrollElement}
          sx={{
            overflowY: "auto", // make it scrollable
            display: "block",
            // pt: `calc(${M3} + ${M5} + ${M3})`, // padding top, so that it can be scrolled away
            transition: `margin-top ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,

            mt: showTopBar ? `calc(${M3} + ${M5} + ${M3})` : "0px",
            scrollbarWidth: "none",
          }}
        >
          {/* add margin for the actual margin, topbar, and margin of top bar */}
          <Box>
            <Outlet />
          </Box>
        </Box>
        <Box
          sx={{
            overflowY: "auto",
            mt: showTopBar ? `calc(${M3} + ${M5} + ${M3})` : "0px",
            transition: `margin-top ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,
            ml: M3,
          }}
        >
          {rightPanel}
        </Box>
      </Box>
    </>
  );
};
