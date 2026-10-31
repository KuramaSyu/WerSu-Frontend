import { describe, expect, it } from "vitest";
import { getContrastRatio } from "@mui/system/colorManipulator";
import {
  buildPaletteFromSwatches,
  buildThemeFromImageRecord,
  clampThemeName,
  DEFAULT_THEME_BLUR,
  isGeneratedThemeRecord,
  MAX_THEME_NAME_LENGTH,
  normalizeGeneratedThemeRecord,
  type GeneratedThemeRecord,
  type ImageSwatchData,
} from "./imageTheme";
import { CustomThemeImpl } from "./customTheme";

const SWATCHES: ImageSwatchData = {
  suggestedMode: "dark",
  dominant: "#3a5a40",
  vibrant: "#588157",
  muted: "#a3b18a",
  lightVibrant: "#b7c9a0",
  darkVibrant: "#2f4634",
  lightMuted: "#dad7cd",
  darkMuted: "#344e41",
};

const HEX = /^#[0-9a-f]{6}$/i;

const PALETTE_FIELDS = [
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
] as const;

describe("clampThemeName", () => {
  it("trims surrounding whitespace", () => {
    expect(clampThemeName("  Forest Mist  ")).toBe("Forest Mist");
  });

  it("caps the name at the max length", () => {
    const long = "a".repeat(300);
    expect(clampThemeName(long)).toHaveLength(MAX_THEME_NAME_LENGTH);
    expect(MAX_THEME_NAME_LENGTH).toBe(128);
  });

  it("leaves short names untouched", () => {
    expect(clampThemeName("Moss")).toBe("Moss");
  });
});

describe("isGeneratedThemeRecord", () => {
  const record: GeneratedThemeRecord = {
    id: "gen-1",
    groupId: "moss",
    name: "moss",
    longName: "Moss",
    mode: "dark",
    palette: buildPaletteFromSwatches(SWATCHES, "dark"),
    backgroundImage: "https://example.com/moss.jpg",
    blurredBackgroundImage: "local:moss-blur",
    blur: 33,
    createdAt: 0,
  };

  it("accepts a well-formed record", () => {
    expect(isGeneratedThemeRecord(record)).toBe(true);
  });

  it("rejects a record with a malformed palette", () => {
    expect(
      isGeneratedThemeRecord({
        ...record,
        palette: { ...record.palette, primary: 7 },
      }),
    ).toBe(false);
  });

  it("rejects a missing background image", () => {
    const withoutBackground: Record<string, unknown> = { ...record };
    delete withoutBackground.backgroundImage;
    expect(isGeneratedThemeRecord(withoutBackground)).toBe(false);
  });
});

describe("normalizeGeneratedThemeRecord", () => {
  const base: GeneratedThemeRecord = {
    id: "gen-legacy",
    groupId: "legacy",
    name: "legacy",
    longName: "Legacy",
    mode: "dark",
    palette: buildPaletteFromSwatches(SWATCHES, "dark"),
    backgroundImage: "https://example.com/legacy.jpg",
    blurredBackgroundImage: "",
    blur: 0,
    createdAt: 0,
  };

  it("fills a missing blurred variant from the original", () => {
    const legacy = { ...base } as Partial<GeneratedThemeRecord>;
    delete legacy.blurredBackgroundImage;
    delete legacy.blur;
    const normalized = normalizeGeneratedThemeRecord(
      legacy as GeneratedThemeRecord,
    );
    expect(normalized.blurredBackgroundImage).toBe(base.backgroundImage);
    expect(normalized.blur).toBe(DEFAULT_THEME_BLUR);
  });

  it("clamps an out-of-range blur", () => {
    const normalized = normalizeGeneratedThemeRecord({ ...base, blur: 900 });
    expect(normalized.blur).toBe(100);
  });
});

describe("buildPaletteFromSwatches", () => {
  it("produces valid hex tokens in dark mode", () => {
    const palette = buildPaletteFromSwatches(SWATCHES, "dark");
    for (const field of PALETTE_FIELDS) {
      expect(palette[field], field).toMatch(HEX);
    }
  });

  it("produces valid hex tokens in light mode", () => {
    const palette = buildPaletteFromSwatches(SWATCHES, "light");
    for (const field of PALETTE_FIELDS) {
      expect(palette[field], field).toMatch(HEX);
    }
  });

  it("uses the muted swatch as the secondary color", () => {
    const palette = buildPaletteFromSwatches(SWATCHES, "dark");
    expect(palette.secondary).toBe(SWATCHES.muted);
  });

  it("regenerates secondary light/dark from the muted secondary", () => {
    const palette = buildPaletteFromSwatches(SWATCHES, "dark");
    // Not the vibrant siblings supplied by Vibrant.
    expect(palette.secondaryLight).not.toBe(SWATCHES.lightVibrant);
    expect(palette.secondaryDark).not.toBe(SWATCHES.darkVibrant);
    // And actually shifted off the base secondary.
    expect(palette.secondaryLight).not.toBe(palette.secondary);
    expect(palette.secondaryDark).not.toBe(palette.secondary);
  });
});

describe("buildThemeFromImageRecord", () => {
  const record: GeneratedThemeRecord = {
    id: "gen-test",
    groupId: "forest-mist",
    name: "forest-mist",
    longName: "Forest Mist",
    mode: "dark",
    palette: buildPaletteFromSwatches(SWATCHES, "dark"),
    backgroundImage: "https://example.com/forest.jpg",
    blurredBackgroundImage: "local:forest-blur",
    blur: 33,
    createdAt: 0,
  };

  it("carries the record's identity onto the theme", () => {
    const theme = buildThemeFromImageRecord(record);
    expect(theme.custom.themeName).toBe("forest-mist");
    expect(theme.custom.longName).toBe("Forest Mist");
    expect(theme.palette.mode).toBe("dark");
  });

  it("prefers the blurred variant as the displayed background", () => {
    const theme = buildThemeFromImageRecord(record);
    expect(theme.custom.chosenBackgroundImage).toBe("local:forest-blur");
    expect(theme.custom.backgroundImages).toEqual([
      "https://example.com/forest.jpg",
      "local:forest-blur",
    ]);
  });

  it("uses the non-blurred source when blur is off", () => {
    const theme = buildThemeFromImageRecord({
      ...record,
      blur: 0,
    });
    expect(theme.custom.chosenBackgroundImage).toBe(
      "https://example.com/forest.jpg",
    );
  });

  it("leaves the background empty when no image is provided", () => {
    const theme = buildThemeFromImageRecord({
      ...record,
      backgroundImage: "",
      blurredBackgroundImage: "",
      blur: 0,
    });
    expect(theme.custom.chosenBackgroundImage).toBeNull();
    expect(theme.custom.backgroundImages).toEqual([]);
  });

  it("uses the generated background and text tokens", () => {
    const theme = buildThemeFromImageRecord(record);
    expect(theme.palette.background.default).toBe(
      record.palette.backgroundDefault,
    );
    expect(theme.palette.background.paper).toBe(record.palette.backgroundPaper);
    expect(theme.palette.text.primary).toBe(record.palette.textPrimary);
  });

  it("keeps semantic text readable on the elevated menu paper", () => {
    const wrapped = new CustomThemeImpl(
      buildThemeFromImageRecord(record),
      undefined,
      { recalculateSuccessInfoWarningErrorColors: true },
    );
    const surface = wrapped.elevate(wrapped.palette.background.paper, 12);
    for (const key of ["error", "warning", "success", "info"] as const) {
      const tone = wrapped.palette[key].text;
      expect(tone, key).toBeTruthy();
      expect(getContrastRatio(tone!, surface), key).toBeGreaterThanOrEqual(3.5);
    }
  });
});
