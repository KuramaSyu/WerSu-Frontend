import { describe, expect, it } from "vitest";
import { getContrastRatio } from "@mui/system/colorManipulator";
import { ACCENT_FONT_FAMILY } from "./customTheme";
import { customThemes } from "./themes";

// The right-click delete rows and other semantic text pick up
// `palette.<semantic>.text`. The tone targets 3.5:1 on the menu paper so
// it stays readable without washing the hue out.
const SEMANTIC_KEYS = ["error", "warning", "success", "info"] as const;
const CONTRAST_TARGET = 3.5;

describe("spacing scale", () => {
  const theme = customThemes[0];

  it("keeps zero at zero instead of 0.25rem", () => {
    expect(theme.spacing(0)).toBe("0rem");
  });

  it("keeps the doubling scale for positive steps", () => {
    expect(theme.spacing(1)).toBe("0.5rem");
    expect(theme.spacing(2)).toBe("1rem");
    expect(theme.spacing(3)).toBe("2rem");
    expect(theme.spacing(4)).toBe("4rem");
  });

  it("joins multi-axis shorthand", () => {
    expect(theme.spacing(1, 0)).toBe("0.5rem 0rem");
  });
});

describe("accent font", () => {
  it("exposes the configured accent family on every registered theme", () => {
    for (const theme of customThemes) {
      expect(theme.custom.accentFontFamily, theme.custom.themeName).toBe(
        ACCENT_FONT_FAMILY,
      );
    }
  });
});

describe("semantic text tones", () => {
  it("gives every theme readable text on the elevated menu paper", () => {
    for (const theme of customThemes) {
      const surface = theme.elevate(theme.palette.background.paper, 12);
      for (const key of SEMANTIC_KEYS) {
        const tone = theme.palette[key].text;
        const label = `${theme.custom.themeName}.${key}`;
        expect(tone, label).toBeTruthy();
        expect(getContrastRatio(tone!, surface), label).toBeGreaterThanOrEqual(
          CONTRAST_TARGET,
        );
      }
    }
  });

  it("keeps the main colour when it already passes", () => {
    // GitHub Light's error red already clears AA on its paper.
    const github = customThemes.find(
      (theme) => theme.custom.themeName === "github",
    )!;
    expect(github.palette.error.text).toBe(github.palette.error.main);
  });
});
