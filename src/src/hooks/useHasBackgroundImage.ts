import { FeatureFlagName, useFeatureStore } from "../zustand/FeatureStore";
import { useThemeStore } from "../zustand/useThemeStore";

/**
 * True when the theme supplies a background image that the shell should
 * paint.
 *
 * This mirrors `AppBackground` / `TranslucentPaper`: an image is active
 * only when the theme has one AND the `IgnoreBackgroundImage` performance
 * flag is off. Surfaces that need to know whether they are sitting on an
 * image (instead of the plain theme colour) should read this instead of
 * re-deriving the same condition, so the outlet texture and the paper
 * translucency can never disagree.
 */
export const useHasBackgroundImage = (): boolean => {
  const themeBackground = useThemeStore((s) => {
    const custom = s.theme.custom;
    return custom.chosenBackgroundImage ?? custom.backgroundImages[0] ?? "";
  });
  const ignoreBackgroundImage = useFeatureStore(
    (s) => s.flags[FeatureFlagName.IgnoreBackgroundImage],
  );

  return !ignoreBackgroundImage && themeBackground.length > 0;
};
