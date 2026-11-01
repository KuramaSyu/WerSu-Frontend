import { useEffect, useRef, useState } from "react";
import { useThemeStore } from "../../zustand/useThemeStore";
import { Box } from "@mui/material";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { StaticCircleBackground } from "../LoadingPage/CircleBackground";
import { AuthCard } from "./EmailLoginForm";
import { Title } from "../LoadingPage/Title";
import { DocumentSwirl } from "../LoadingPage/DocumentSwirl";
import { LogoSvgComponent } from "../LoadingPage/Main";
import { useLoadingStore } from "../../zustand/loadingStore";
import { useUsersStore, useUserStore } from "../../zustand/userStore";
import { defaultTheme } from "../../theme/themes";
import { useLayout, useRightPanel } from "../../LayoutProvider";
import { M3, M4, M5 } from "../../statics";

export const LoginPage: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  const [oldTheme, setOldTheme] = useState<string | null>();
  const { isMobile } = useBreakpoint();
  const { setLeftPanelOpen, setRightPanelOpen } = useLayout();
  const logoAnchorRef = useRef<HTMLDivElement>(null);
  // Login is chrome-free; drop any right panel left over from a
  // previous session.
  useRightPanel(null);

  useEffect(() => {
    setLeftPanelOpen(false);
    setRightPanelOpen(false);
  }, []);
  useEffect(() => {
    if (theme.custom.themeName !== "default") {
      setOldTheme(theme.custom.themeName);
      setTheme("default");
    }
    return;
  }, [theme]);

  useEffect(() => {
    if (oldTheme === null || oldTheme === undefined) return;
    return () => {
      console.log("set old theme");
      setTheme(oldTheme);
    };
  }, [oldTheme]);

  return (
    <Box
      aria-label="Login"
      sx={{
        position: "relative",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: isMobile ? "column-reverse" : "row",
        alignItems: "stretch",
        justifyContent: "center",
        backgroundColor: theme.palette.background.paper,
        zIndex: 2,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
        }}
      >
        <StaticCircleBackground
          color={theme.palette.background.default}
          atXPercent={isMobile ? 50 : -40}
          atYPercent={isMobile ? 140 : 50}
          sizePercent={100}
        />
      </Box>

      {/* Full-screen decorative swirl: above circle 1, below circle 2
          and every real UI element. Centred on the logo via anchorRef. */}
      <DocumentSwirl anchorRef={logoAnchorRef} sx={{ zIndex: 2 }} />

      {/* Circle 2: a second, identical circle with a gradient-opacity
          fill that dims the swirl beneath it and blends into circle 1. */}
      <Box sx={{ position: "absolute", inset: 0, zIndex: 3 }}>
        <StaticCircleBackground
          fade
          color={theme.palette.background.default}
          atXPercent={isMobile ? 50 : -40}
          atYPercent={isMobile ? 140 : 50}
          sizePercent={100}
        />
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: isMobile ? "100%" : "40%",
          height: isMobile ? "auto" : "100%",
          minHeight: 0,
          zIndex: 4,
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <AuthCard />
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: isMobile ? "100%" : "60%",
          height: isMobile ? "100%" : "100%",
          flex: isMobile ? "1 1 auto" : "0 0 auto",
          minHeight: 0,
          justifyContent: "space-between",
          alignItems: "center",
          py: 4,
          zIndex: 4,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            fontSize: isMobile ? "3rem" : "clamp(2.5rem, 8vh, 8rem)",
            lineHeight: 1.1,
            textAlign: "center",
            flex: "0 0 auto",
          }}
        >
          <Title theme={defaultTheme} />
        </Box>
        <Box
          ref={logoAnchorRef}
          sx={{
            // Cap the logo to the smaller of the pane's width / height
            // so the page never overflows regardless of viewport.
            position: "relative",
            width: "min(100%, 60vh, 60vw)",
            height: "min(100%, 60vh, 60vw)",
            aspectRatio: "1 / 1",
            display: "flex",
            zIndex: 5,
            flex: "1 1 auto",
            minHeight: 0,
          }}
        >
          <LogoSvgComponent />
        </Box>
      </Box>
    </Box>
  );
};
