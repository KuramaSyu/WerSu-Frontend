import { Box } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";
import { FeatureFlagName, useFeatureStore } from "../zustand/FeatureStore";
import { useCachedImageUrl } from "../hooks/useCachedImageUrl";
import { useManualBlurImageUrl } from "../hooks/useManualBlurImageUrl";

// Fullscreen background layer. Renders the active theme's background
// image (when it has one); themes without an image render nothing.
// `local:<id>` blobs and remote URLs both resolve through the IndexedDB
// cache, which downloads and persists remote URLs on first use.
//
// Blurred themes must never flash the sharp source: a downloaded theme is
// registered before its blurred variant has been rendered locally (and a
// device-local one may have lost its IndexedDB bytes), so the chosen
// background can legitimately be empty for a while. In that window this
// renders nothing (the theme's base color shows through) and waits for the
// repair/generation pass instead of falling back to the sharp image.
//
// When `PreRenderThemeBlur` is off, the sharp source is fetched at display
// resolution and blurred on the fly (a canvas transform, not a CSS filter on
// the box) so the pre-rendered second cache copy is not needed.
const AppBackground: React.FC = () => {
  const { theme } = useThemeStore();
  const preRenderBlur = useFeatureStore(
    (s) => s.flags[FeatureFlagName.PreRenderThemeBlur],
  );
  const custom = theme.custom;
  const sharpImage = custom.backgroundImages[0] ?? "";
  const chosenImage = custom.chosenBackgroundImage ?? "";
  const blur = custom.blur ?? 0;

  // Only read the pre-rendered variant from the cache when it actually
  // exists and differs from the sharp source. An empty/unknown chosen value
  // disables the lookup so the sharp source is never shown for a blurred
  // theme.
  const storedUrl = useCachedImageUrl(
    blur <= 0
      ? chosenImage.length > 0
        ? chosenImage
        : sharpImage
      : preRenderBlur &&
          chosenImage.length > 0 &&
          chosenImage !== sharpImage
        ? chosenImage
        : "",
  );
  // Manual mode only; passing "" disables the lookup.
  const manualUrl = useManualBlurImageUrl(
    preRenderBlur || blur <= 0 ? "" : sharpImage,
    blur,
  );

  const resolved = blur > 0 && !preRenderBlur ? manualUrl : storedUrl;

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
