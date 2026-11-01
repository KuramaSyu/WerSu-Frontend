// @vitest-environment jsdom

import "../test/setup";

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const blurImageToWebp = vi.fn();
vi.mock("../utils/imageBlur", () => ({
  fetchImageBlob: vi.fn(),
  blurImageToWebp: (...args: unknown[]) => blurImageToWebp(...args),
}));

import type { GeneratedThemeRecord } from "../theme/imageTheme";
import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";
import { useThemeStore } from "../zustand/useThemeStore";
import { syncedBlurCacheKey } from "../utils/syncedThemeImages";
import { useThemeImageRepair } from "./useThemeImageRepair";

const record = (overrides: Partial<GeneratedThemeRecord> = {}): GeneratedThemeRecord => ({
  id: "gen-dark-repair",
  groupId: "repair",
  name: "repair-dark",
  longName: "Repair",
  mode: "dark",
  palette: {
    primary: "#112233",
    primaryLight: "#223344",
    primaryDark: "#001122",
    secondary: "#334455",
    secondaryLight: "#445566",
    secondaryDark: "#223344",
    vibrant: "#556677",
    muted: "#667788",
    mutedLight: "#778899",
    mutedDark: "#556677",
    backgroundDefault: "#0b0b0b",
    backgroundPaper: "#141414",
    panel: "#101010",
    textPrimary: "#f5f5f5",
    textSecondary: "#cccccc",
  },
  backgroundImage: "https://x/img.webp",
  blurredBackgroundImage: "",
  blur: 0,
  createdAt: 1,
  ...overrides,
});

describe("useThemeImageRepair", () => {
  beforeEach(() => {
    blurImageToWebp.mockReset();
    useImageBlobCacheStore.setState({
      byUrl: new Map(),
      inflight: new Map(),
      hydrated: true,
    });
    useThemeStore.setState({ generatedThemes: [] });
  });

  it("repairs a generated theme whose blurred blob is gone", async () => {
    const testRecord = record({
      blurredBackgroundImage: "local:lost",
      blur: 50,
    });
    useThemeStore.setState({ generatedThemes: [testRecord] });
    await useImageBlobCacheStore
      .getState()
      .put(testRecord.backgroundImage, new Blob(["src"]));
    const rendered = new Blob(["rendered"]);
    blurImageToWebp.mockResolvedValue(rendered);

    renderHook(() => useThemeImageRepair());

    await waitFor(() => {
      const updated = useThemeStore
        .getState()
        .generatedThemes.find((r) => r.id === testRecord.id);
      expect(updated?.blurredBackgroundImage).toBe(
        syncedBlurCacheKey(testRecord.backgroundImage, 50),
      );
    });
    expect(
      await useImageBlobCacheStore
        .getState()
        .resolve(syncedBlurCacheKey(testRecord.backgroundImage, 50)),
    ).not.toBeNull();
  });

  it("leaves healthy themes alone", async () => {
    const source = "https://x/img.webp";
    const key = syncedBlurCacheKey(source, 33);
    await useImageBlobCacheStore.getState().put(key, new Blob(["blur"]));
    const testRecord = record({
      backgroundImage: source,
      blurredBackgroundImage: key,
      blur: 33,
    });
    useThemeStore.setState({ generatedThemes: [testRecord] });

    renderHook(() => useThemeImageRepair());

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(useThemeStore.getState().generatedThemes[0]).toBe(testRecord);
    expect(blurImageToWebp).not.toHaveBeenCalled();
  });
});
