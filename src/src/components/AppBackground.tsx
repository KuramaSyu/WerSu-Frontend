import { Box } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";
import { useCachedImageUrl } from "../hooks/useCachedImageUrl";

// Fullscreen background layer. Renders the active theme's background
// image (when it has one); themes without an image render nothing.
// `local:<id>` blobs and remote URLs both resolve through the IndexedDB
// cache, which downloads and persists remote URLs on first use.
const AppBackground: React.FC = () => {
  const { theme } = useThemeStore();
  const themeImage =
    theme.custom.chosenBackgroundImage ??
    theme.custom.backgroundImages[0] ??
    "";
  const sourceUrl = useCachedImageUrl(themeImage);

  if (sourceUrl === null) {
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
