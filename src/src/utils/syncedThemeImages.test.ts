// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAttachmentApi } from "../api/AttachmentApi";
import { BACKEND_BASE } from "../statics";
import type { GeneratedThemeRecord } from "../theme/imageTheme";
import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";

const { fetchImageBlobMock, blurImageToWebpMock } = vi.hoisted(() => ({
  fetchImageBlobMock: vi.fn(),
  blurImageToWebpMock: vi.fn(),
}));
vi.mock("../utils/imageBlur", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/imageBlur")>()),
  fetchImageBlob: fetchImageBlobMock,
  blurImageToWebp: blurImageToWebpMock,
}));

import {
  cacheOriginalThemeImage,
  cacheSyncedThemeImage,
  cacheSyncedThemeImageFallback,
  ensureSyncedBlur,
  refetchSyncedThemeImage,
  repairThemeImageCache,
  resolveThemeSourceBlob,
  SYNCED_THEME_IMAGE_WIDTH_DESKTOP,
  SYNCED_THEME_IMAGE_WIDTH_MOBILE,
  syncedBlurCacheKey,
  syncedOriginalCacheKey,
  toAttachmentImageUrl,
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

describe("toAttachmentImageUrl", () => {
  it("returns an already-built image endpoint unchanged when no width is requested", () => {
    const url = `${BACKEND_BASE}/api/attachments/image?width=1080&format=webp&key=attachments%252Fabc`;
    expect(toAttachmentImageUrl(url)).toBe(url);
  });

  it("rebuilds an image endpoint when a width is requested", () => {
    const url = `${BACKEND_BASE}/api/attachments/image?width=720&format=webp&key=attachments%252Fabc`;
    expect(toAttachmentImageUrl(url, 1080)).toContain("width=1080");
  });

  it("rewrites a raw download URL to the image endpoint", () => {
    const key = "attachments/abc-123";
    const url = `${BACKEND_BASE}/api/attachments/?key=${encodeURIComponent(key)}`;
    expect(toAttachmentImageUrl(url, 1080)).toContain("/api/attachments/image");
  });
});

describe("cacheSyncedThemeImage", () => {
  beforeEach(() => {
    fetchImageBlobMock.mockReset();
    useImageBlobCacheStore.setState({
      byUrl: new Map(),
      inflight: new Map(),
      hydrated: true,
    });
  });

  it("does not overwrite a cached full-resolution original", async () => {
    const source = `${BACKEND_BASE}/api/attachments/image?width=1080&key=attachments%252Fabc`;
    const original = new Blob(["original"], { type: "image/png" });
    await useImageBlobCacheStore
      .getState()
      .put(syncedOriginalCacheKey(source), original);
    const record = makeRecord({
      backgroundImage: source,
      blur: 33,
      blurredBackgroundImage: "",
    });

    await cacheSyncedThemeImage(record);

    expect(fetchImageBlobMock).not.toHaveBeenCalled();
    expect(await useImageBlobCacheStore.getState().resolve(source)).toBeNull();
  });

  it("downloads and caches the sharp source even when blur is disabled", async () => {
    const blob = new Blob(["image"], { type: "image/webp" });
    fetchImageBlobMock.mockResolvedValue(blob);
    const record = makeRecord({
      backgroundImage: `${BACKEND_BASE}/api/attachments/image?width=1080&format=webp&key=attachments%252Fabc`,
      blur: 0,
    });

    await expect(cacheSyncedThemeImage(record)).resolves.toBe(record);

    expect(fetchImageBlobMock).toHaveBeenCalledWith(record.backgroundImage);
    expect(
      useImageBlobCacheStore.getState().byUrl.has(record.backgroundImage),
    ).toBe(true);
  });

  it("does nothing for empty or device-local sources", async () => {
    await cacheSyncedThemeImage(makeRecord({ backgroundImage: "" }));
    await cacheSyncedThemeImage(
      makeRecord({ backgroundImage: "local:blob-1" }),
    );
    expect(fetchImageBlobMock).not.toHaveBeenCalled();
  });

  it("skips the download when the cached blurred variant matches the blur", async () => {
    const source = `${BACKEND_BASE}/api/attachments/image?width=1080&key=attachments%252Fabc`;
    const record = makeRecord({
      blur: 33,
      backgroundImage: source,
      blurredBackgroundImage: syncedBlurCacheKey(source, 33),
    });

    await cacheSyncedThemeImage(record);

    expect(fetchImageBlobMock).not.toHaveBeenCalled();
  });

  it("downloads the source when the cached blurred key is from an older blur", async () => {
    const source = `${BACKEND_BASE}/api/attachments/image?width=1080&key=attachments%252Fabc`;
    fetchImageBlobMock.mockResolvedValue(
      new Blob(["src"], { type: "image/webp" }),
    );
    const record = makeRecord({
      blur: 50,
      backgroundImage: source,
      blurredBackgroundImage: syncedBlurCacheKey(source, 20),
    });

    await cacheSyncedThemeImage(record);

    expect(fetchImageBlobMock).toHaveBeenCalledWith(source);
  });

  it("keeps the remote URL when the download fails", async () => {
    fetchImageBlobMock.mockRejectedValue(new Error("HTTP 401"));
    const record = makeRecord({
      backgroundImage: `${BACKEND_BASE}/api/attachments/image?key=attachments%252Fabc`,
    });

    await expect(cacheSyncedThemeImage(record)).resolves.toBe(record);
  });
});

describe("cacheOriginalThemeImage", () => {
  beforeEach(() => {
    fetchImageBlobMock.mockReset();
    useImageBlobCacheStore.setState({
      byUrl: new Map(),
      inflight: new Map(),
      hydrated: true,
    });
  });

  it("stores the full-size original under the theme background key", async () => {
    const original = new Blob(["original"], { type: "image/png" });
    const spy = vi
      .spyOn(getAttachmentApi(), "getAttachment")
      .mockResolvedValue(original);
    const record = makeRecord({
      backgroundImage: `${BACKEND_BASE}/api/attachments/image?width=1080&format=webp&key=attachments%252Fabc`,
    });

    try {
      await expect(cacheOriginalThemeImage(record)).resolves.toBe(true);

      // Downloads through the raw key, not the compressed image endpoint.
      expect(spy).toHaveBeenCalledWith("attachments/abc");
      expect(
        useImageBlobCacheStore
          .getState()
          .byUrl.get(record.backgroundImage)?.blob,
      ).toBe(original);
    } finally {
      spy.mockRestore();
    }
  });

  it("no-ops for local and external sources", async () => {
    await expect(
      cacheOriginalThemeImage(makeRecord({ backgroundImage: "local:abc" })),
    ).resolves.toBe(false);
    await expect(
      cacheOriginalThemeImage(
        makeRecord({ backgroundImage: "https://example.com/a.png" }),
      ),
    ).resolves.toBe(false);
  });

  it("stores the original under both the source and the dedicated edit key", async () => {
    const original = new Blob(["original"], { type: "image/png" });
    const spy = vi
      .spyOn(getAttachmentApi(), "getAttachment")
      .mockResolvedValue(original);
    const record = makeRecord({
      backgroundImage: `${BACKEND_BASE}/api/attachments/image?key=attachments%252Fabc`,
    });

    try {
      await expect(cacheOriginalThemeImage(record)).resolves.toBe(true);

      const store = useImageBlobCacheStore.getState();
      expect((await store.resolve(record.backgroundImage))?.blob).toBe(
        original,
      );
      expect(
        (await store.resolve(syncedOriginalCacheKey(record.backgroundImage)))
          ?.blob,
      ).toBe(original);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("cacheSyncedThemeImageFallback", () => {
  beforeEach(() => {
    fetchImageBlobMock.mockReset();
    useImageBlobCacheStore.setState({
      byUrl: new Map(),
      inflight: new Map(),
      hydrated: true,
    });
  });

  it("downloads the compressed image variant when nothing is cached", async () => {
    const variant = new Blob(["variant"], { type: "image/webp" });
    fetchImageBlobMock.mockResolvedValue(variant);
    const source = `${BACKEND_BASE}/api/attachments/image?key=attachments%252Fabc`;

    await expect(cacheSyncedThemeImageFallback(source)).resolves.toBe(true);

    const url = fetchImageBlobMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("/api/attachments/image");
    expect(url).toContain("width=1080");
    expect(url).toContain("format=webp");
    expect(
      (await useImageBlobCacheStore.getState().resolve(source))?.blob,
    ).toBe(variant);
    // The original slot stays empty so the editor retries full resolution.
    expect(
      await useImageBlobCacheStore
        .getState()
        .resolve(syncedOriginalCacheKey(source)),
    ).toBeNull();
  });

  it("skips non-attachment and already-cached sources", async () => {
    await expect(
      cacheSyncedThemeImageFallback("https://example.com/a.png"),
    ).resolves.toBe(false);
    const source = `${BACKEND_BASE}/api/attachments/image?key=attachments%252Fabc`;
    await useImageBlobCacheStore
      .getState()
      .put(source, new Blob(["cached"], { type: "image/webp" }));
    await expect(cacheSyncedThemeImageFallback(source)).resolves.toBe(false);
    expect(fetchImageBlobMock).not.toHaveBeenCalled();
  });
});

describe("refetchSyncedThemeImage", () => {
  beforeEach(() => {
    fetchImageBlobMock.mockReset();
    useImageBlobCacheStore.setState({
      byUrl: new Map(),
      inflight: new Map(),
      hydrated: true,
    });
  });

  it("upgrades a missing image to the full-resolution original", async () => {
    const original = new Blob(["original"], { type: "image/png" });
    const spy = vi
      .spyOn(getAttachmentApi(), "getAttachment")
      .mockResolvedValue(original);
    const record = makeRecord({
      backgroundImage: `${BACKEND_BASE}/api/attachments/image?key=attachments%252Fabc`,
    });

    try {
      await expect(refetchSyncedThemeImage(record)).resolves.toBe(original);
      const store = useImageBlobCacheStore.getState();
      expect((await store.resolve(record.backgroundImage))?.blob).toBe(
        original,
      );
      expect(
        (await store.resolve(syncedOriginalCacheKey(record.backgroundImage)))
          ?.blob,
      ).toBe(original);
      // The original download succeeded, so no compressed fetch was needed.
      expect(fetchImageBlobMock).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("falls back to the compressed variant when the original is gone", async () => {
    const spy = vi
      .spyOn(getAttachmentApi(), "getAttachment")
      .mockResolvedValue(null);
    const variant = new Blob(["variant"], { type: "image/webp" });
    fetchImageBlobMock.mockResolvedValue(variant);
    const record = makeRecord({
      backgroundImage: `${BACKEND_BASE}/api/attachments/image?key=attachments%252Fabc`,
    });

    try {
      await expect(refetchSyncedThemeImage(record)).resolves.toBe(variant);
      expect(
        (await useImageBlobCacheStore
          .getState()
          .resolve(record.backgroundImage))?.blob,
      ).toBe(variant);
    } finally {
      spy.mockRestore();
    }
  });

  it("returns null for device-local sources", async () => {
    await expect(
      refetchSyncedThemeImage(makeRecord({ backgroundImage: "local:gone" })),
    ).resolves.toBeNull();
  });
});

describe("repairThemeImageCache", () => {
  beforeEach(() => {
    fetchImageBlobMock.mockReset();
    blurImageToWebpMock.mockReset();
    useImageBlobCacheStore.setState({
      byUrl: new Map(),
      inflight: new Map(),
      hydrated: true,
    });
  });

  it("re-downloads the source when blurred pixels were stored under it", async () => {
    const source = `${BACKEND_BASE}/api/attachments/image?width=1080&key=attachments%252Fabc`;
    // Corrupt state from the earlier overwrite bug: the entry under the
    // source key holds blurred pixels.
    await useImageBlobCacheStore
      .getState()
      .put(source, new Blob(["blurred"], { type: "image/webp" }));
    const sharp = new Blob(["sharp"], { type: "image/webp" });
    fetchImageBlobMock.mockResolvedValue(sharp);
    blurImageToWebpMock.mockResolvedValue(
      new Blob(["rendered"], { type: "image/webp" }),
    );
    const record = makeRecord({
      backgroundImage: source,
      blurredBackgroundImage: source,
      blur: 33,
    });

    await repairThemeImageCache(record);

    expect(fetchImageBlobMock).toHaveBeenCalledWith(source);
    expect(
      (await useImageBlobCacheStore.getState().resolve(source))?.blob,
    ).toBe(sharp);
  });

  it("regenerates a blurred blob whose bytes are gone", async () => {
    const source = "https://x/img.webp";
    const sourceBlob = new Blob(["src"], { type: "image/webp" });
    await useImageBlobCacheStore.getState().put(source, sourceBlob);
    const rendered = new Blob(["rendered"], { type: "image/webp" });
    blurImageToWebpMock.mockResolvedValue(rendered);
    const record = makeRecord({
      backgroundImage: source,
      blurredBackgroundImage: "local:lost-blob",
      blur: 50,
    });

    const repaired = await repairThemeImageCache(record);

    expect(repaired.blurredBackgroundImage).toBe(
      syncedBlurCacheKey(source, 50),
    );
    expect(
      (await useImageBlobCacheStore
        .getState()
        .resolve(repaired.blurredBackgroundImage))?.blob,
    ).toBe(rendered);
  });

  it("leaves a healthy theme untouched", async () => {
    const source = "https://x/img.webp";
    const key = syncedBlurCacheKey(source, 33);
    await useImageBlobCacheStore
      .getState()
      .put(key, new Blob(["cached"], { type: "image/webp" }));
    const record = makeRecord({
      backgroundImage: source,
      blurredBackgroundImage: key,
      blur: 33,
    });

    await expect(repairThemeImageCache(record)).resolves.toBe(record);
    expect(fetchImageBlobMock).not.toHaveBeenCalled();
    expect(blurImageToWebpMock).not.toHaveBeenCalled();
  });
});

describe("resolveThemeSourceBlob", () => {
  beforeEach(() => {
    useImageBlobCacheStore.setState({
      byUrl: new Map(),
      inflight: new Map(),
      hydrated: true,
    });
  });

  it("prefers the full-resolution original over the render source", async () => {
    const source = "https://x/img.webp";
    const original = new Blob(["original"], { type: "image/png" });
    const compressed = new Blob(["compressed"], { type: "image/webp" });
    await useImageBlobCacheStore.getState().put(source, compressed);
    await useImageBlobCacheStore
      .getState()
      .put(syncedOriginalCacheKey(source), original);

    await expect(
      resolveThemeSourceBlob(makeRecord({ backgroundImage: source })),
    ).resolves.toBe(original);
  });

  it("falls back to the render source", async () => {
    const source = "https://x/img.webp";
    const compressed = new Blob(["compressed"], { type: "image/webp" });
    await useImageBlobCacheStore.getState().put(source, compressed);

    await expect(
      resolveThemeSourceBlob(makeRecord({ backgroundImage: source })),
    ).resolves.toBe(compressed);
  });

  it("returns null for a missing device-local source", async () => {
    await expect(
      resolveThemeSourceBlob(makeRecord({ backgroundImage: "local:gone" })),
    ).resolves.toBeNull();
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
});

describe("ensureSyncedBlur regeneration", () => {
  beforeEach(() => {
    useImageBlobCacheStore.setState({
      byUrl: new Map(),
      inflight: new Map(),
      hydrated: true,
    });
    blurImageToWebpMock.mockReset();
  });

  it("re-renders when the cached key was produced for an older blur", async () => {
    const source = `${BACKEND_BASE}/api/attachments/image?width=1080&format=webp&key=attachments%252Fabc`;
    const sourceBlob = new Blob(["src"], { type: "image/webp" });
    await useImageBlobCacheStore.getState().put(source, sourceBlob);
    const staleKey = syncedBlurCacheKey(source, 20);
    await useImageBlobCacheStore
      .getState()
      .put(staleKey, new Blob(["old"], { type: "image/webp" }));
    const rendered = new Blob(["new"], { type: "image/webp" });
    blurImageToWebpMock.mockResolvedValue(rendered);

    const record = makeRecord({
      backgroundImage: source,
      blurredBackgroundImage: staleKey,
      blur: 50,
    });
    const result = await ensureSyncedBlur(record);

    const expectedKey = syncedBlurCacheKey(source, 50);
    expect(blurImageToWebpMock).toHaveBeenCalledWith(sourceBlob, 50);
    expect(result.blurredBackgroundImage).toBe(expectedKey);
    const cached = await useImageBlobCacheStore.getState().resolve(expectedKey);
    expect(cached?.blob).toBe(rendered);
  });

  it("writes the blurred variant without touching the source entry", async () => {
    const source = "https://x/img.webp";
    const sourceBlob = new Blob(["src"], { type: "image/webp" });
    await useImageBlobCacheStore.getState().put(source, sourceBlob);
    const rendered = new Blob(["rendered"], { type: "image/webp" });
    blurImageToWebpMock.mockResolvedValue(rendered);

    const record = makeRecord({
      backgroundImage: source,
      blurredBackgroundImage: "",
      blur: 40,
    });
    const result = await ensureSyncedBlur(record);

    const store = useImageBlobCacheStore.getState();
    expect((await store.resolve(source))?.blob).toBe(sourceBlob);
    expect(
      (await store.resolve(result.blurredBackgroundImage))?.blob,
    ).toBe(rendered);
    expect(result.blurredBackgroundImage).not.toBe(source);
  });

  it("reuses the cached variant when the pointer matches the current blur", async () => {
    const source = "https://x/img.webp";
    const key = syncedBlurCacheKey(source, 33);
    await useImageBlobCacheStore
      .getState()
      .put(key, new Blob(["cached"], { type: "image/webp" }));
    const record = makeRecord({
      backgroundImage: source,
      blurredBackgroundImage: key,
      blur: 33,
    });

    await expect(ensureSyncedBlur(record)).resolves.toBe(record);
    expect(blurImageToWebpMock).not.toHaveBeenCalled();
  });
});
