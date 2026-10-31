import { useMemo } from "react";
import { Box } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";
import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";

// Fullscreen background layer. Renders the active theme's background
// image (when it has one); themes without an image render nothing.
// `local:<id>` images (uploaded from disk) resolve through the blob
// cache; remote URLs render directly.
const AppBackground: React.FC = () => {
  const { theme } = useThemeStore();
  const themeImage =
    theme.custom.chosenBackgroundImage ??
    theme.custom.backgroundImages[0] ??
    "";
  const cachedObjectUrl = useImageBlobCacheStore(
    (s) => s.byUrl.get(themeImage)?.objectUrl ?? null,
  );

  const sourceUrl = useMemo<string | undefined>(() => {
    if (themeImage.length === 0) {
      return undefined;
    }
    return cachedObjectUrl ?? themeImage;
  }, [themeImage, cachedObjectUrl]);

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
        zIndex: 0,
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
