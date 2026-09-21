import { describe, expect, it, vi } from "vitest";

// Stub the broken dynamic-color import path that customTheme.ts
// transitively pulls in via material-color-utilities.
vi.mock("@material/material-color-utilities", () => ({
  themeFromSourceColor: () => ({}),
  argbFromHex: () => 0,
  hexFromArgb: () => "#000000",
}));

// Importing themes runs the single production CustomThemeImpl wrap.
import { tokyoNightStorm } from "./themes";

describe("CustomThemeImpl getContrastText on Tokyo Night Storm", () => {
  it("returns a palette token for background.paper", () => {
    const fg = tokyoNightStorm.palette.getContrastText(
      tokyoNightStorm.palette.background.paper,
    );
    expect([
      tokyoNightStorm.palette.text.primary,
      tokyoNightStorm.palette.background.default,
    ]).toContain(fg);
  });

  it("matches text.primary for the dark paper surface", () => {
    expect(tokyoNightStorm.palette.mode).toBe("dark");
    const fg = tokyoNightStorm.palette.getContrastText(
      tokyoNightStorm.palette.background.paper,
    );
    expect(fg).toBe(tokyoNightStorm.palette.text.primary);
  });

  it("matches background.default for the light primary surface", () => {
    expect(tokyoNightStorm.palette.mode).toBe("dark");
    const fg = tokyoNightStorm.palette.getContrastText(
      tokyoNightStorm.palette.primary.main,
    );
    expect(fg).toBe(tokyoNightStorm.palette.background.default);
  });
});
