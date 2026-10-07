import { useMemo } from "react";
import { Box } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";
import { useSelectedBackgroundImageStore } from "../zustand/useSelectedBackgroundImageStore";

// Fullscreen background layer.
// User image first, then the theme image, then nothing.
// Prefers the cached blob URL so the browser does not re-download on every render.
const AppBackground: React.FC = () => {
  const { theme } = useThemeStore();
  const userImage = useSelectedBackgroundImageStore((s) => s.userImage);
  const cachedObjectUrl = useSelectedBackgroundImageStore(
    (s) => s.cachedObjectUrl,
  );
  const themeImage =
    theme.custom.chosenBackgroundImage ?? theme.custom.backgroundImages[0] ?? "";

  // Empty userImage and empty themeImage mean "no image".
  // No silent fallback: if the cached object URL has not resolved
  // yet, the raw `local:bg-...` key is passed through so we can
  // see the failure in DevTools and in the bg-debug logs rather
  // than papering over it with the theme image.
  const sourceUrl = useMemo<string | undefined>(() => {
    if (userImage !== null && userImage.length > 0) {
      return cachedObjectUrl ?? userImage;
    }
    if (themeImage.length > 0) {
      return themeImage;
    }
    return undefined;
  }, [userImage, cachedObjectUrl, themeImage]);

  if (sourceUrl === undefined) {
    return null;
  }

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: -1,
        backgroundColor: theme.palette.background.default,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${sourceUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    </Box>
  );
};

export default AppBackground;
