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
import { useUser } from "../../api/queries/useUser";

export const MainPage: React.FC = () => {
  const { data: user } = useUser();
  const { isLoading } = useLoadingStore();
  const { isMobile } = useBreakpoint();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );

  return (
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
  );
};
