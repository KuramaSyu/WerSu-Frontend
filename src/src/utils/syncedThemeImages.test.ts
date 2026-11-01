// @vitest-environment node

import { describe, expect, it } from "vitest";
import { BACKEND_BASE } from "../statics";
import type { GeneratedThemeRecord } from "../theme/imageTheme";
import {
  ensureSyncedBlur,
  SYNCED_THEME_IMAGE_WIDTH_DESKTOP,
  SYNCED_THEME_IMAGE_WIDTH_MOBILE,
  syncedBlurCacheKey,
  withSyncedImageWidth,
} from "./syncedThemeImages";

const makeRecord = (
  overrides: Partial<GeneratedThemeRecord> = {},
): GeneratedThemeRecord => ({
  id: "gen-dark-1",
  groupId: "group-1",
  name: "sunset-dark",
  longName: "Sunset",
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
  backgroundImage: "",
  blurredBackgroundImage: "",
  blur: 0,
  createdAt: 1,
  ...overrides,
});

describe("withSyncedImageWidth", () => {
  it("rewrites a linkAttachment URL to the image endpoint at the given width", () => {
    const key = "attachments/01a19924-e14b-705b-ba26-2429dc0e50ff";
    const record = makeRecord({
      backgroundImage: `${BACKEND_BASE}/attachments/${encodeURIComponent(key)}`,
    });

    const result = withSyncedImageWidth(
      record,
      SYNCED_THEME_IMAGE_WIDTH_DESKTOP,
    );

    expect(result.backgroundImage).toBe(
      `${BACKEND_BASE}/api/attachments/image?width=1080&format=webp&key=${encodeURIComponent(
        encodeURIComponent(key),
      )}`,
    );
  });

  it("rewrites the raw query-param download URL to the image endpoint", () => {
    const key = "attachments/abc-123";
    const record = makeRecord({
      backgroundImage: `${BACKEND_BASE}/api/attachments/?key=${encodeURIComponent(key)}`,
    });

    const result = withSyncedImageWidth(record, 1080);

    expect(result.backgroundImage).toContain("/api/attachments/image");
    expect(result.backgroundImage).toContain("width=1080");
    expect(result.backgroundImage).toContain("format=webp");
  });

  it("uses the mobile width when asked", () => {
    const key = "attachments/abc-123";
    const record = makeRecord({
      backgroundImage: `${BACKEND_BASE}/attachments/${encodeURIComponent(key)}`,
    });

    const result = withSyncedImageWidth(
      record,
      SYNCED_THEME_IMAGE_WIDTH_MOBILE,
    );

    expect(result.backgroundImage).toContain("width=720");
  });

  it("rewrites the blurred variant too", () => {
    const key = "attachments/abc-123";
    const record = makeRecord({
      backgroundImage: `${BACKEND_BASE}/attachments/${encodeURIComponent(key)}`,
      blurredBackgroundImage: `${BACKEND_BASE}/attachments/${encodeURIComponent(
        key,
      )}`,
    });

    const result = withSyncedImageWidth(record, 1080);

    expect(result.blurredBackgroundImage).toContain("/api/attachments/image");
    expect(result.blurredBackgroundImage).toContain("format=webp");
  });

  it("rebuilds an already-built image URL (no double parsing)", () => {
    const key = "attachments/abc-123";
    const record = makeRecord({
      backgroundImage: `${BACKEND_BASE}/api/attachments/image?width=720&format=webp&key=${encodeURIComponent(
        encodeURIComponent(key),
      )}`,
    });

    const result = withSyncedImageWidth(record, 1080);

    expect(result.backgroundImage).toContain("width=1080");
  });

  it("passes device-local and empty values through untouched", () => {
    const record = makeRecord({
      backgroundImage: "local:blob-1",
      blurredBackgroundImage: "",
    });

    const result = withSyncedImageWidth(record, 1080);

    expect(result.backgroundImage).toBe("local:blob-1");
    expect(result.blurredBackgroundImage).toBe("");
  });

  it("leaves unrelated URLs untouched", () => {
    const record = makeRecord({
      backgroundImage: "https://example.com/photo.webp",
    });

    const result = withSyncedImageWidth(record, 1080);

    // The trailing "photo.webp" segment must not be mistaken for an
    // attachment key.
    expect(result.backgroundImage).toBe("https://example.com/photo.webp");
  });
});

describe("syncedBlurCacheKey", () => {
  it("is deterministic and namespaced as a local blob", () => {
    const a = syncedBlurCacheKey("https://x/img?width=1080", 33);
    const b = syncedBlurCacheKey("https://x/img?width=1080", 33);
    expect(a).toBe(b);
    expect(a.startsWith("local:synced-blur-")).toBe(true);
  });

  it("changes when the source or blur changes", () => {
    const base = syncedBlurCacheKey("https://x/img?width=1080", 33);
    expect(syncedBlurCacheKey("https://x/img?width=720", 33)).not.toBe(base);
    expect(syncedBlurCacheKey("https://x/img?width=1080", 60)).not.toBe(
      base,
    );
  });
});

describe("ensureSyncedBlur fast paths", () => {
  it("does nothing when blur is disabled", async () => {
    const record = makeRecord({ blur: 0, backgroundImage: "https://x/a.webp" });
    await expect(ensureSyncedBlur(record)).resolves.toBe(record);
  });

  it("does nothing when there is no source image", async () => {
    const record = makeRecord({ blur: 33, backgroundImage: "" });
    await expect(ensureSyncedBlur(record)).resolves.toBe(record);
  });

  it("keeps an existing device-local blurred blob", async () => {
    const record = makeRecord({
      blur: 33,
      backgroundImage: "https://x/a.webp",
      blurredBackgroundImage: "local:already-there",
    });
    await expect(ensureSyncedBlur(record)).resolves.toBe(record);
  });
});
