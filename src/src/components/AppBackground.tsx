import { Box } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";
import { useCachedImageUrl } from "../hooks/useCachedImageUrl";

// Fullscreen background layer. Renders the active theme's background
// image (when it has one); themes without an image render nothing.
// `local:<id>` blobs and remote URLs both resolve through the IndexedDB
// cache, which downloads and persists remote URLs on first use.
//
// If the chosen (blurred) image is a `local:` blob whose bytes are gone
// (lost IndexedDB write, cleared store), the theme's sharp source is
// rendered instead so the background never goes blank; the repair hook
// (`useThemeImageRepair`) regenerates the blob in the meantime.
const AppBackground: React.FC = () => {
  const { theme } = useThemeStore();
  const themeImage =
    theme.custom.chosenBackgroundImage ??
    theme.custom.backgroundImages[0] ??
    "";
  const sharpImage = theme.custom.backgroundImages[0] ?? "";
  const sourceUrl = useCachedImageUrl(themeImage);
  // Only meaningful when the blurred variant differs from the sharp source
  // (blur > 0 with a pre-rendered blob); passing "" disables the lookup.
  const fallbackUrl = useCachedImageUrl(themeImage === sharpImage ? "" : sharpImage);

  const resolved = sourceUrl ?? fallbackUrl;

  if (resolved === null) {
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
          backgroundImage: `url(${resolved})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    </Box>
  );
};

export default AppBackground;
