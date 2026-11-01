// @vitest-environment jsdom

import "../test/setup";

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchImageBlob = vi.fn();
vi.mock("../utils/imageBlur", () => ({
  fetchImageBlob: (...args: unknown[]) => fetchImageBlob(...args),
}));

import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";
import { useCachedImageUrl } from "./useCachedImageUrl";

const blob = (): Blob => new Blob(["image"], { type: "image/webp" });

describe("useCachedImageUrl", () => {
  beforeEach(() => {
    fetchImageBlob.mockReset();
    if (typeof URL.createObjectURL !== "function") {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: () => "blob:cached",
      });
    }
    if (typeof URL.revokeObjectURL !== "function") {
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: () => undefined,
      });
    }
    useImageBlobCacheStore.setState({
      byUrl: new Map(),
      inflight: new Map(),
      hydrated: true,
    });
  });

  it("returns the cached object URL without fetching", () => {
    useImageBlobCacheStore.setState({
      byUrl: new Map([
        [
          "https://example.com/theme.webp",
          {
            blob: blob(),
            objectUrl: "blob:seed",
            contentType: "image/webp",
            fetchedAt: 1,
          },
        ],
      ]),
    });

    const { result } = renderHook(() =>
      useCachedImageUrl("https://example.com/theme.webp"),
    );

    expect(result.current).toBe("blob:seed");
    expect(fetchImageBlob).not.toHaveBeenCalled();
  });

  it("downloads and caches a remote URL on first use", async () => {
    fetchImageBlob.mockResolvedValue(blob());

    const { result } = renderHook(() =>
      useCachedImageUrl("https://example.com/new.webp"),
    );

    // Remote URLs fall back to the network URL until the download lands.
    expect(result.current).toBe("https://example.com/new.webp");

    await waitFor(() => {
      expect(
        useImageBlobCacheStore
          .getState()
          .byUrl.has("https://example.com/new.webp"),
      ).toBe(true);
    });
    expect(fetchImageBlob).toHaveBeenCalledWith(
      "https://example.com/new.webp",
    );
  });

  it("does not fetch device-local keys and returns null on a miss", () => {
    const { result } = renderHook(() => useCachedImageUrl("local:missing"));
    expect(result.current).toBeNull();
    expect(fetchImageBlob).not.toHaveBeenCalled();
  });

  it("returns null for an empty url", () => {
    const { result } = renderHook(() => useCachedImageUrl(""));
    expect(result.current).toBeNull();
    expect(fetchImageBlob).not.toHaveBeenCalled();
  });

  it("repairs a missing attachment image from the width-capped variant", async () => {
    const url =
      "http://localhost:8080/api/attachments/image?key=attachments%252Fabc";
    const variant = blob();
    // The first (background) fetch fails, so the hook retries through the
    // image endpoint and caches the variant as the render fallback.
    fetchImageBlob
      .mockRejectedValueOnce(new Error("HTTP 404"))
      .mockResolvedValue(variant);

    renderHook(() => useCachedImageUrl(url));

    await waitFor(() => {
      expect(useImageBlobCacheStore.getState().byUrl.has(url)).toBe(true);
    });
    const retryUrl = fetchImageBlob.mock.calls[1]?.[0] as string;
    expect(retryUrl).toContain("/api/attachments/image");
    expect(retryUrl).toContain("width=1080");
    expect(retryUrl).toContain("format=webp");
  });
});
