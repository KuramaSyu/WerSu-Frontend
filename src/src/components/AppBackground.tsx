import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";
import { useUserBackgroundImageStore } from "../zustand/useUserBackgroundImageStore";
import { useBlurredBackground } from "../hooks/useBlurredBackground";

/**
 * Fullscreen background layer
 */
const AppBackground: React.FC = () => {
  const { theme } = useThemeStore();
  const userImage = useUserBackgroundImageStore((s) => s.userImage);

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        backgroundColor: theme.palette.background.default,
        overflow: "hidden",
      }}
    >
      {userImage !== undefined && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${userImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
    </Box>
  );
};

export default AppBackground;
