import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import { M1, M2, M3, M4, M5 } from "./statics";
import { useLayout } from "./LayoutProvider";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUser } from "./api/queries/useUser";
import { LoadingPage } from "./pages/LoadingPage/Main";
import TopBar from "./components/TopBar";

export const AppShell: React.FC = () => {
  const { leftPanel, rightPanel } = useLayout();
  const [showSplashScreen, setShowSplashScreen] = useState(false);
  const [exitPercentage, setExitPercentage] = useState(
    Math.round(Math.random() * 100),
  );
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
          gridTemplateColumns: "280px 1fr 320px",
          height: "100vh",
        }}
      >
        <Box
          sx={{
            borderRight: 1,
            borderColor: "divider",
            overflowY: "auto",
            pt: `calc(${M3} + ${M5} + ${M4})`,
          }}
        >
          {leftPanel}
        </Box>
        <Box
          ref={setScrollElement}
          sx={{
            overflowY: "auto", // make it scrollable
            display: "block",
          }}
        >
          {/* add margin for the actual margin, topbar, and margin of top bar */}
          <Box sx={{ mt: `calc(${M4} + ${M5} + ${M3})` }}>
            <Outlet />
          </Box>
        </Box>
        <Box
          sx={{
            borderLeft: 1,
            borderColor: "divider",
            overflowY: "auto",
          }}
        >
          {rightPanel}
        </Box>
      </Box>
    </>
  );
};
