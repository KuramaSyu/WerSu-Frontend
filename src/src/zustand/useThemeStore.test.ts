// Regression tests for the theme store's generated dark+light pairs and
// its mode-toggle bookkeeping.
//
// The top-bar light/dark toggle remembers the last theme used per mode
// (`lastLightTheme` / `lastDarkTheme`). Generated themes can be
// deleted, so that memory must be cleared when the theme it points at
// disappears — otherwise the toggle silently no-ops.

// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "./useThemeStore";
import {
  buildPaletteFromSwatches,
  type ImageSwatchData,
} from "../theme/imageTheme";

const SWATCHES: ImageSwatchData = {
  suggestedMode: "light",
  dominant: "#c9b8a3",
  vibrant: "#a98467",
  muted: "#c9b8a3",
  lightVibrant: "#d8c3a5",
  darkVibrant: "#6c584c",
  lightMuted: "#f0ead2",
  darkMuted: "#6c584c",
};

const addPair = (longName: string) =>
  useThemeStore.getState().addGeneratedTheme({
    longName,
    palettes: {
      dark: buildPaletteFromSwatches(SWATCHES, "dark"),
      light: buildPaletteFromSwatches(SWATCHES, "light"),
    },
    backgroundImage: "https://example.com/temp.jpg",
    blurredBackgroundImage: "",
    blur: 0,
  });

describe("useThemeStore generated theme pairs", () => {
  beforeEach(() => {
    useThemeStore.setState({
      lastLightTheme: null,
      lastDarkTheme: null,
    });
  });

  it("switches to a light theme and records it as the last light theme", async () => {
    const light = useThemeStore
      .getState()
      .customThemes.find((t) => t.palette.mode === "light");
    expect(light, "a light theme exists").toBeTruthy();

    await useThemeStore.getState().setTheme(light!.custom.themeName);

    expect(useThemeStore.getState().theme.palette.mode).toBe("light");
    expect(useThemeStore.getState().lastLightTheme).toBe(
      light!.custom.themeName,
    );
  });

  it("creates a dark and a light record sharing a group", () => {
    const pair = addPair("Twin");
    try {
      expect(pair.dark.mode).toBe("dark");
      expect(pair.light.mode).toBe("light");
      expect(pair.dark.groupId).toBe(pair.light.groupId);
      expect(pair.dark.name).not.toBe(pair.light.name);

      const names = useThemeStore
        .getState()
        .customThemes.map((t) => t.custom.themeName);
      expect(names).toContain(pair.dark.name);
      expect(names).toContain(pair.light.name);
    } finally {
      useThemeStore.getState().removeGeneratedTheme(pair.dark.id);
    }
  });

  it("removes both variants and clears their per-mode memory", () => {
    const pair = addPair("Temp");
    useThemeStore.setState({
      lastLightTheme: pair.light.name,
      lastDarkTheme: pair.dark.name,
    });

    useThemeStore.getState().removeGeneratedTheme(pair.light.id);

    expect(useThemeStore.getState().lastLightTheme).toBeNull();
    expect(useThemeStore.getState().lastDarkTheme).toBeNull();
    const remaining = useThemeStore.getState().generatedThemes;
    expect(remaining.some((r) => r.id === pair.dark.id)).toBe(false);
    expect(remaining.some((r) => r.id === pair.light.id)).toBe(false);
  });

  it("clears the per-mode memory when generated themes are cleared", () => {
    const pair = addPair("Temp Clear");
    useThemeStore.setState({ lastDarkTheme: pair.dark.name });

    useThemeStore.getState().clearGeneratedThemes();

    expect(useThemeStore.getState().lastDarkTheme).toBeNull();
    expect(useThemeStore.getState().generatedThemes).toEqual([]);
  });
});
