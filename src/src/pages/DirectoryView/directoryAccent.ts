import type { CustomTheme } from "../../theme/customTheme";

/**
 * Two-tone palette for directory (chapter) rows.
 *
 * Uses the theme's `primary` color in two contrast blends so it adapts to
 * the active theme and any custom palette override.
 */
export const directoryColors = (theme: CustomTheme): readonly string[] =>
  [
    theme.palette.primary.main,
    theme.blendWithContrast("primary", 0.3, undefined),
  ] as const;

/**
 * Two-tone palette for note rows.
 *
 * Mirrors `DirectoryItem.NOTE_COLORS` so the two surfaces stay in sync.
 */
export const noteColors = (theme: CustomTheme): readonly string[] =>
  [
    theme.palette.secondary.main,
    theme.blendWithContrast("secondary", 0.3, undefined),
  ] as const;
