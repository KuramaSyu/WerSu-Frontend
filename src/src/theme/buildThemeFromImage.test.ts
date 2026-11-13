import { describe, expect, it, vi } from "vitest";

// Fake Vibrant palette so `extractImageSwatches` can run without a
// canvas / real image. Bright colors -> the suggested mode is light.
const PALETTE = {
  Vibrant: { hex: "#588157", population: 100, r: 88, g: 129, b: 87 },
  LightVibrant: { hex: "#b7c9a0", population: 60, r: 183, g: 201, b: 160 },
  DarkVibrant: { hex: "#2f4634", population: 40, r: 47, g: 70, b: 52 },
  Muted: { hex: "#a3b18a", population: 80, r: 163, g: 177, b: 138 },
  LightMuted: { hex: "#dad7cd", population: 50, r: 218, g: 215, b: 205 },
  DarkMuted: { hex: "#344e41", population: 30, r: 52, g: 78, b: 65 },
};

vi.mock("node-vibrant/browser", () => {
  const chain = {
    maxDimension: () => chain,
    getPalette: () => Promise.resolve(PALETTE),
  };
  return { Vibrant: { from: () => chain } };
});

// Network images are downloaded to a blob before Vibrant reads them.
vi.mock("../utils/imageBlur", () => ({
  fetchImageBlob: vi.fn().mockResolvedValue(new Blob(["pixels"])),
}));

// jsdom has no object-URL support.
if (typeof URL.createObjectURL !== "function") {
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => "blob:mock-image"),
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: vi.fn(),
    writable: true,
  });
}

import { buildThemeFromImage } from "./imageTheme";

describe("buildThemeFromImage", () => {
  it("derives the theme in the requested mode", async () => {
    const theme = await buildThemeFromImage("https://example.com/a.jpg", {
      mode: "dark",
      name: "header-image",
    });

    expect(theme.palette.mode).toBe("dark");
    expect(theme.palette.primary.main).toBe(PALETTE.Vibrant.hex);
    expect(theme.custom.themeName).toBe("header-image");
    // No background image: the header banner only borrows the palette.
    expect(theme.custom.chosenBackgroundImage).toBeNull();
  });

  it("falls back to the mode the image suggests", async () => {
    // The swatches above are population-weighted toward dark tones, so
    // Vibrant's luminance heuristic suggests the dark mode.
    const theme = await buildThemeFromImage("https://example.com/a.jpg");
    expect(theme.palette.mode).toBe("dark");
  });
});