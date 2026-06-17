import { Box, ThemeProvider, Typography } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import { AnimatePresence, motion } from "framer-motion";

import { useEffect, useMemo, useRef, useState } from "react";

import { M1, M2, M3, M4, M5, M6 } from "../../statics";
import { useUserStore } from "../../zustand/userStore";
import { useLoadingStore } from "../../zustand/loadingStore";
import { LoadingPage } from "../LoadingPage/Main";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { LoginPage } from "../LoginPage/Main";

import { MainContent } from "./MainContent";
import TopBar from "../../components/TopBar";

export const MainPage: React.FC = () => {
  const { theme } = useThemeStore();
  const { user } = useUserStore();
  const { isLoading } = useLoadingStore();
  const { isMobile } = useBreakpoint();
  const [exitPercentage, setExitPercentage] = useState(
    Math.round(Math.random() * 100),
  );
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const oneOrZero = Math.round(exitPercentage / 100) * 100;
  const DISABLE_LOADING_ANIMATION = false; // Set to true to disable the loading animation

  return (
    <ThemeProvider theme={theme}>
      {/* Loading Animation for Loading Page
      which is as long visible as "overlay" as
      it needs to fetch all resources via REST. */}
      {!DISABLE_LOADING_ANIMATION && (
        <AnimatePresence initial={false}>
          {isLoading && (
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
      )}

      {/* we currently need the loadpage since it prepares stores */}
      {isLoading && DISABLE_LOADING_ANIMATION && (
        <>
          <Box
            sx={{
              zIndex: -1,
              top: 0,
              left: 0,
              position: "fixed",
            }}
          >
            <LoadingPage />
          </Box>
        </>
      )}

      {/* Box for either the Main App or Login Page, depending on user state */}

      <Box
        ref={setScrollElement}
        sx={{
          display: "flex",
          flexDirection: "row",
          height: "100%",
          overflow: "auto", // Prevents overflow
          paddingTop: user !== null && !isMobile ? M1 : undefined,
        }}
      >
        {user !== null || isLoading ? (
          <>
            <TopBar scrollContainer={scrollElement}></TopBar>
            <MainContent></MainContent>
          </>
        ) : (
          <>
            {console.log("render login page")}
            <LoginPage></LoginPage>
          </>
        )}
      </Box>
    </ThemeProvider>
  );
};
