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

  return (
    <>
      {user !== null ? (
        <MainContent></MainContent>
      ) : (
        <>
          {console.log("render login page")}
          <LoginPage></LoginPage>
        </>
      )}
    </>
  );
};
