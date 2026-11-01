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
import { useImageBlobCacheStore } from "./useImageBlobCache";
import {
  buildPaletteFromSwatches,
  type GeneratedThemeRecord,
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

const syncedRecord = (): GeneratedThemeRecord => ({
  id: "synced-test-dark",
  groupId: "synced-test",
  name: "synced-test-dark",
  longName: "Synced Test",
  mode: "dark",
  palette: buildPaletteFromSwatches(SWATCHES, "dark"),
  backgroundImage: "",
  blurredBackgroundImage: "",
  blur: 0,
  createdAt: Date.now(),
});

describe("useThemeStore synced theme preference", () => {
  beforeEach(() => {
    useThemeStore.setState({
      themeLocked: false,
      lastLightTheme: null,
      pendingThemePreference: null,
    });
  });

  it("applies a synced preference while the device is unlocked", async () => {
    const light = useThemeStore
      .getState()
      .customThemes.find((t) => t.palette.mode === "light");
    expect(light, "a light theme exists").toBeTruthy();

    await useThemeStore.getState().applyThemePreference({
      mode: "light",
      light: light!.custom.themeName,
      dark: null,
    });

    expect(useThemeStore.getState().themeName).toBe(light!.custom.themeName);
  });

  it("ignores a synced preference while the device is locked", async () => {
    const dark = useThemeStore
      .getState()
      .customThemes.find((t) => t.palette.mode === "dark");
    expect(dark, "a dark theme exists").toBeTruthy();
    const before = useThemeStore.getState().themeName;

    useThemeStore.setState({ themeLocked: true });
    await useThemeStore.getState().applyThemePreference({
      mode: "dark",
      light: null,
      dark: dark!.custom.themeName,
    });

    expect(useThemeStore.getState().themeName).toBe(before);
  });

  it("parks and later applies a preference whose synced theme is not registered yet", async () => {
    const record = syncedRecord();
    try {
      // The synced preference arrives before its `custom-themes` row, so
      // the theme name is unknown at apply time. It must not fall back to
      // the default theme.
      await useThemeStore.getState().applyThemePreference({
        mode: "dark",
        light: null,
        dark: record.name,
      });
      expect(useThemeStore.getState().pendingThemePreference).not.toBeNull();
      expect(useThemeStore.getState().themeName).not.toBe(record.name);

      // Registering the synced theme flushes the parked preference.
      useThemeStore.getState().registerSyncedThemes("user:test", [record]);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(useThemeStore.getState().themeName).toBe(record.name);
      expect(useThemeStore.getState().pendingThemePreference).toBeNull();
    } finally {
      useThemeStore.getState().registerSyncedThemes("user:test", []);
    }
  });

  it("re-applies a persisted synced theme once it registers while pinned", async () => {
    const record = syncedRecord();
    try {
      // Simulate reload: the device is pinned and the persisted theme name
      // points at the synced theme, but only the default theme object was
      // resolvable during rehydration.
      useThemeStore.setState({
        themeLocked: true,
        themeName: record.name,
        pendingThemePreference: null,
      });

      useThemeStore.getState().registerSyncedThemes("user:test", [record]);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(useThemeStore.getState().themeName).toBe(record.name);
      expect(useThemeStore.getState().theme.custom.themeName).toBe(
        record.name,
      );
    } finally {
      useThemeStore.getState().registerSyncedThemes("user:test", []);
      useThemeStore.setState({ themeName: "default", themeLocked: false });
      await useThemeStore.getState().setTheme("default");
    }
  });

  it("deletes a synced theme locally so it can be re-fetched", () => {
    const record = syncedRecord();
    try {
      useThemeStore.getState().registerSyncedThemes("user:test", [record]);
      expect(
        useThemeStore
          .getState()
          .syncedThemes.some((r) => r.id === record.id),
      ).toBe(true);

      useThemeStore.getState().deleteThemeLocally(record.id);
      expect(
        useThemeStore
          .getState()
          .syncedThemes.some((r) => r.id === record.id),
      ).toBe(false);

      // Re-registering from the source brings it back (the re-fetch path).
      useThemeStore.getState().registerSyncedThemes("user:test", [record]);
      expect(
        useThemeStore
          .getState()
          .syncedThemes.some((r) => r.id === record.id),
      ).toBe(true);
    } finally {
      useThemeStore.getState().registerSyncedThemes("user:test", []);
    }
  });

  it("clears a deleted theme's cached blobs", () => {
    const pair = addPair("Purge Me");
    const srcKey = `local:src-${pair.dark.id}`;
    const blurKey = `local:blur-${pair.dark.id}`;
    useThemeStore.setState({
      generatedThemes: useThemeStore.getState().generatedThemes.map((r) =>
        r.id === pair.dark.id
          ? {
              ...r,
              backgroundImage: srcKey,
              blurredBackgroundImage: blurKey,
              blur: 33,
            }
          : r,
      ),
    });
    useImageBlobCacheStore.setState({
      byUrl: new Map([
        [
          srcKey,
          {
            blob: new Blob(["s"]),
            objectUrl: "blob:src",
            contentType: "image/webp",
            fetchedAt: 1,
          },
        ],
        [
          blurKey,
          {
            blob: new Blob(["b"]),
            objectUrl: "blob:blur",
            contentType: "image/webp",
            fetchedAt: 1,
          },
        ],
      ]),
      inflight: new Map(),
      hydrated: true,
    });

    useThemeStore.getState().deleteThemeLocally(pair.dark.id);

    expect(
      useThemeStore.getState().generatedThemes.some(
        (r) => r.groupId === pair.dark.groupId,
      ),
    ).toBe(false);
    expect(useImageBlobCacheStore.getState().byUrl.has(srcKey)).toBe(false);
    expect(useImageBlobCacheStore.getState().byUrl.has(blurKey)).toBe(false);
  });

  it("adopts an edited synced theme as a local user theme", () => {
    const record = syncedRecord();
    try {
      useThemeStore.getState().registerSyncedThemes("user:test", [record]);

      useThemeStore.getState().updateGeneratedTheme(record.id, {
        longName: "Renamed synced",
        palette: { ...record.palette, primary: "#010203" },
        blur: 40,
      });

      const local = useThemeStore
        .getState()
        .generatedThemes.find((r) => r.id === record.id);
      expect(local?.longName).toBe("Renamed synced");
      expect(local?.palette.primary).toBe("#010203");
      expect(local?.blur).toBe(40);
      expect(local?.scope).toBe("user");
      // The read-only synced copy is replaced by the editable local one.
      expect(
        useThemeStore
          .getState()
          .syncedThemes.some((r) => r.id === record.id),
      ).toBe(false);
    } finally {
      useThemeStore.getState().removeGeneratedTheme(record.id);
      useThemeStore.getState().registerSyncedThemes("user:test", []);
    }
  });
});
