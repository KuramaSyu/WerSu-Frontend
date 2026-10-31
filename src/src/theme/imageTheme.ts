import { createTheme } from "@mui/material";
import { Vibrant } from "node-vibrant/browser";
import type { CustomTheme } from "./customTheme";

// Derive the palette/swatch types from Vibrant's public API rather than
// importing `@vibrant/color` directly, which is an undeclared transitive
// dependency that pnpm's strict resolution would reject.
type VibrantPalette = Awaited<
  ReturnType<ReturnType<typeof Vibrant.from>["getPalette"]>
>;
type VibrantSwatch = NonNullable<VibrantPalette[string]>;
import {
  getRelativeLuminance,
  hexToHsl,
  hslToHex,
} from "../utils/blendWithContrast";
import { normalizeImageUrl } from "../utils/imageUrl";

/**
 * Generate an MUI theme from the color palette of an uploaded image.
 *
 * The pipeline is two stages so the settings UI can let the user flip
 * between light/dark without re-running the (relatively expensive)
 * Vibrant quantization:
 *
 *   1. `extractImageSwatches(src)` -> a handful of representative hex
 *      colors + a suggested mode derived from the image's luminance.
 *   2. `buildPaletteFromSwatches(swatches, mode)` -> a full token
 *      palette (backgrounds, text, surfaces, ...) in the chosen mode.
 *
 * `GeneratedThemeRecord` is the serializable shape persisted to
 * localStorage; `buildThemeFromImageRecord` turns it back into an MUI
 * theme at boot / on demand.
 */

export type ThemeMode = "light" | "dark";

/** Maximum length of a user-supplied theme name. */
export const MAX_THEME_NAME_LENGTH = 128;

/** Default background blur (percent) for newly generated themes. */
export const DEFAULT_THEME_BLUR = 33;

/** Trim and hard-cap a theme name to `MAX_THEME_NAME_LENGTH`. */
export function clampThemeName(name: string): string {
  return name.trim().slice(0, MAX_THEME_NAME_LENGTH);
}

/** Representative colors pulled out of an image by Vibrant. */
export interface ImageSwatchData {
  /** Mode Vibrant suggests based on the image's average luminance. */
  suggestedMode: ThemeMode;
  dominant: string;
  vibrant: string;
  muted: string;
  lightVibrant: string;
  darkVibrant: string;
  lightMuted: string;
  darkMuted: string;
}

/** A complete palette derived from an image for one mode. */
export interface ImageThemePalette {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  vibrant: string;
  muted: string;
  mutedLight: string;
  mutedDark: string;
  backgroundDefault: string;
  backgroundPaper: string;
  panel: string;
  textPrimary: string;
  textSecondary: string;
}

/** Persisted description of a user-generated theme. */
export interface GeneratedThemeRecord {
  id: string;
  /**
   * Shared id for the dark + light pair generated from one image. Used
   * to find the sibling variant when toggling modes.
   */
  groupId: string;
  /** Slug used as the theme's short identifier (picker value). */
  name: string;
  /** User-facing display name. */
  longName: string;
  mode: ThemeMode;
  palette: ImageThemePalette;
  /**
   * Non-blurred background image. Either a remote URL or a `local:<id>`
   * blob-cache key for an image uploaded from disk. Empty when the
   * source image should not be used as the app background.
   */
  backgroundImage: string;
  /**
   * Pre-rendered blurred variant of `backgroundImage`. A `local:<id>`
   * blob-cache key; empty when blur is disabled or the variant could
   * not be generated.
   */
  blurredBackgroundImage: string;
  /** Background blur strength, 0-100. */
  blur: number;
  createdAt: number;
}

/**
 * Fill in the blurred-variant fields on a record persisted before the
 * blur feature existed. Assumes the record already passed
 * `isGeneratedThemeRecord`.
 */
export function normalizeGeneratedThemeRecord(
  record: GeneratedThemeRecord,
): GeneratedThemeRecord {
  const blurredBackgroundImage =
    typeof record.blurredBackgroundImage === "string"
      ? record.blurredBackgroundImage
      : record.backgroundImage;
  const blur =
    typeof record.blur === "number" && Number.isFinite(record.blur)
      ? Math.max(0, Math.min(100, record.blur))
      : DEFAULT_THEME_BLUR;
  const groupId =
    typeof record.groupId === "string" && record.groupId.length > 0
      ? record.groupId
      : record.name;
  return { ...record, groupId, blurredBackgroundImage, blur };
}

const FALLBACK_COLOR = "#5e81ac";

const PALETTE_KEYS: readonly (keyof ImageThemePalette)[] = [
  "primary",
  "primaryLight",
  "primaryDark",
  "secondary",
  "secondaryLight",
  "secondaryDark",
  "vibrant",
  "muted",
  "mutedLight",
  "mutedDark",
  "backgroundDefault",
  "backgroundPaper",
  "panel",
  "textPrimary",
  "textSecondary",
];

/** Runtime guard for a persisted record, so a corrupt storage entry
 *  cannot crash the theme store during rehydration. */
export function isGeneratedThemeRecord(
  value: unknown,
): value is GeneratedThemeRecord {
  if (value === null || typeof value !== "object") return false;
  const record = value as Partial<GeneratedThemeRecord>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.longName !== "string" ||
    typeof record.backgroundImage !== "string" ||
    (record.mode !== "light" && record.mode !== "dark") ||
    record.palette === null ||
    typeof record.palette !== "object"
  ) {
    return false;
  }
  const palette = record.palette as Partial<ImageThemePalette>;
  return PALETTE_KEYS.every((key) => typeof palette[key] === "string");
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Shift a hex color's HSL lightness by `delta` percentage points. */
function shiftLightness(hex: string, delta: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, clamp(l + delta, 0, 100));
}

const paletteSwatchHex = (
  palette: VibrantPalette,
  key: keyof VibrantPalette,
): string | null => palette[key]?.hex ?? null;

/**
 * Run Vibrant over an image and normalize its palette into a compact,
 * serializable set of hex colors. `src` may be an object URL, a data
 * URL, or a remote URL.
 */
export async function extractImageSwatches(
  src: string,
): Promise<ImageSwatchData> {
  const vibrantPalette = await Vibrant.from(normalizeImageUrl(src))
    .maxDimension(512)
    .getPalette();

  const swatches = Object.values(vibrantPalette).filter(
    (swatch): swatch is VibrantSwatch => swatch !== null,
  );

  let population = 0;
  let weightedLuminance = 0;
  for (const swatch of swatches) {
    population += swatch.population;
    weightedLuminance +=
      getRelativeLuminance(swatch.r, swatch.g, swatch.b) * swatch.population;
  }
  const averageLuminance =
    population > 0 ? weightedLuminance / population : 0.5;
  const suggestedMode: ThemeMode = averageLuminance < 0.5 ? "dark" : "light";

  const dominant =
    [...swatches].sort((a, b) => b.population - a.population)[0]?.hex ??
    FALLBACK_COLOR;
  const vibrant = paletteSwatchHex(vibrantPalette, "Vibrant") ?? dominant;
  const muted = paletteSwatchHex(vibrantPalette, "Muted") ?? dominant;

  return {
    suggestedMode,
    dominant,
    vibrant,
    muted,
    lightVibrant:
      paletteSwatchHex(vibrantPalette, "LightVibrant") ??
      shiftLightness(vibrant, 15),
    darkVibrant:
      paletteSwatchHex(vibrantPalette, "DarkVibrant") ??
      shiftLightness(vibrant, -15),
    lightMuted:
      paletteSwatchHex(vibrantPalette, "LightMuted") ??
      shiftLightness(muted, 15),
    darkMuted:
      paletteSwatchHex(vibrantPalette, "DarkMuted") ??
      shiftLightness(muted, -15),
  };
}

/**
 * Turn the extracted swatches into a full token palette in the chosen
 * mode. Backgrounds and text are synthesized from the image's dominant
 * hue so the result reads as a cohesive scheme rather than a random
 * assortment of accents.
 */
export function buildPaletteFromSwatches(
  swatches: ImageSwatchData,
  mode: ThemeMode,
): ImageThemePalette {
  const { dominant, vibrant, muted, lightMuted, darkMuted } = swatches;

  const primary = vibrant;
  // Secondary reuses the muted swatch; its light/dark siblings are
  // regenerated from that color rather than borrowed from the vibrant
  // swatches.
  const secondary = muted;

  const dominantHue = hexToHsl(dominant).h;

  if (mode === "dark") {
    const base = hexToHsl(darkMuted);
    const baseSaturation = clamp(base.s, 8, 35);
    return {
      primary,
      primaryLight: shiftLightness(primary, 14),
      primaryDark: shiftLightness(primary, -14),
      secondary,
      secondaryLight: shiftLightness(secondary, 14),
      secondaryDark: shiftLightness(secondary, -14),
      vibrant: primary,
      muted,
      mutedLight: lightMuted,
      mutedDark: shiftLightness(darkMuted, -8),
      backgroundDefault: hslToHex(base.h, baseSaturation, 11),
      backgroundPaper: hslToHex(base.h, baseSaturation, 16),
      panel: hslToHex(base.h, baseSaturation, 13),
      textPrimary: hslToHex(dominantHue, 18, 94),
      textSecondary: hslToHex(dominantHue, 12, 68),
    };
  }

  const base = hexToHsl(lightMuted);
  const baseSaturation = clamp(base.s, 10, 40);
  return {
    primary,
    primaryLight: shiftLightness(primary, 14),
    primaryDark: shiftLightness(primary, -14),
    secondary,
    secondaryLight: shiftLightness(secondary, 14),
    secondaryDark: shiftLightness(secondary, -14),
    vibrant: primary,
    muted,
    mutedLight: shiftLightness(lightMuted, 6),
    mutedDark: darkMuted,
    backgroundDefault: hslToHex(base.h, baseSaturation, 96),
    backgroundPaper: hslToHex(base.h, baseSaturation, 91),
    panel: hslToHex(base.h, baseSaturation, 88),
    textPrimary: hslToHex(dominantHue, 25, 14),
    textSecondary: hslToHex(dominantHue, 15, 42),
  };
}

/**
 * Rebuild an MUI theme from a persisted generated-theme record. The
 * caller (theme store) registers it with the `ThemeManager` so it
 * behaves like any of the bundled themes.
 */
export function buildThemeFromImageRecord(
  record: GeneratedThemeRecord,
): CustomTheme {
  const palette = record.palette;
  // Prefer the pre-blurred variant when blur is active; fall back to the
  // original source otherwise.
  const displayBackground =
    record.blur > 0 && record.blurredBackgroundImage.length > 0
      ? record.blurredBackgroundImage
      : record.backgroundImage;
  return createTheme({
    palette: {
      mode: record.mode,
      primary: {
        main: palette.primary,
        light: palette.primaryLight,
        dark: palette.primaryDark,
      },
      secondary: {
        main: palette.secondary,
        light: palette.secondaryLight,
        dark: palette.secondaryDark,
      },
      vibrant: {
        main: palette.vibrant,
        light: palette.primaryLight,
        dark: palette.primaryDark,
      },
      muted: {
        main: palette.muted,
        light: palette.mutedLight,
        dark: palette.mutedDark,
      },
      background: {
        default: palette.backgroundDefault,
        paper: palette.backgroundPaper,
      },
      text: {
        primary: palette.textPrimary,
        secondary: palette.textSecondary,
      },
      surfaces: {
        panel: palette.panel,
      },
    },
    custom: {
      backgroundImages: [
        record.backgroundImage,
        record.blurredBackgroundImage,
      ].filter((src) => src.length > 0),
      chosenBackgroundImage:
        displayBackground.length > 0 ? displayBackground : null,
      themeName: record.name,
      longName: record.longName,
    },
  }) as unknown as CustomTheme;
}
