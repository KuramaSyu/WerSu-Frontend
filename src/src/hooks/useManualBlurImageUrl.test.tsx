// @vitest-environment jsdom

import "../test/setup";

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchImageBlob = vi.fn();
const blurImageToWebp = vi.fn();
vi.mock("../utils/imageBlur", () => ({
  fetchImageBlob: (...args: unknown[]) => fetchImageBlob(...args),
  blurImageToWebp: (...args: unknown[]) => blurImageToWebp(...args),
}));

vi.mock("./useBreakpoint", () => ({
  useBreakpoint: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isXL: false,
  }),
}));

import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";
import { useManualBlurImageUrl } from "./useManualBlurImageUrl";

const blob = (content = "image"): Blob =>
  new Blob([content], { type: "image/webp" });

describe("useManualBlurImageUrl", () => {
  beforeEach(() => {
    fetchImageBlob.mockReset();
    blurImageToWebp.mockReset();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: () => "blob:manual",
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: () => undefined,
    });
    useImageBlobCacheStore.setState({
      byUrl: new Map(),
      inflight: new Map(),
      hydrated: true,
    });
  });

  it("fetches the source and blurs it without caching the result", async () => {
    const source = blob("sharp");
    const rendered = blob("blurred");
    fetchImageBlob.mockResolvedValue(source);
    blurImageToWebp.mockResolvedValue(rendered);

    const { result } = renderHook(() =>
      useManualBlurImageUrl(
        "/api/attachments/image?width=720&format=webp&key=attachments%252Fabc",
        50,
      ),
    );

    await waitFor(() => expect(result.current).toBe("blob:manual"));
    expect(fetchImageBlob).toHaveBeenCalledTimes(1);
    // 1080p desktop width is requested from the image endpoint.
    expect(fetchImageBlob).toHaveBeenCalledWith(
      expect.stringContaining("width=1080"),
    );
    expect(blurImageToWebp).toHaveBeenCalledWith(source, 50);
    // Only the sharp source may be cached by the hook; never the blur.
    expect(useImageBlobCacheStore.getState().byUrl.size).toBe(0);
  });

  it("reads a device-local source from the cache instead of the network", async () => {
    const source = blob("local");
    useImageBlobCacheStore.setState({
      byUrl: new Map([
        [
          "local:theme",
          {
            blob: source,
            objectUrl: "blob:source",
            contentType: "image/webp",
            fetchedAt: 1,
          },
        ],
      ]),
    });
    blurImageToWebp.mockResolvedValue(blob("blurred"));

    const { result } = renderHook(() =>
      useManualBlurImageUrl("local:theme", 33),
    );

    await waitFor(() => expect(result.current).toBe("blob:manual"));
    expect(fetchImageBlob).not.toHaveBeenCalled();
    expect(blurImageToWebp).toHaveBeenCalledWith(source, 33);
  });

  it("retries from the cache when the first fetch fails", async () => {
    fetchImageBlob.mockRejectedValue(new Error("offline"));
    blurImageToWebp.mockResolvedValue(blob("blurred"));

    const { result } = renderHook(() =>
      useManualBlurImageUrl("https://example.com/theme.jpg", 50),
    );

    await waitFor(() => expect(fetchImageBlob).toHaveBeenCalled());
    expect(result.current).toBeNull();

    // The sync/repair pass caches the sharp source after the failed fetch.
    act(() => {
      useImageBlobCacheStore.setState({
        byUrl: new Map([
          [
            "https://example.com/theme.jpg",
            {
              blob: blob("sharp"),
              objectUrl: "blob:source",
              contentType: "image/webp",
              fetchedAt: 1,
            },
          ],
        ]),
      });
    });

    await waitFor(() => expect(result.current).toBe("blob:manual"));
  });

  it("does nothing when the blur is disabled", () => {
    const { result } = renderHook(() =>
      useManualBlurImageUrl("https://example.com/theme.jpg", 0),
    );
    expect(result.current).toBeNull();
    expect(fetchImageBlob).not.toHaveBeenCalled();
    expect(blurImageToWebp).not.toHaveBeenCalled();
  });
});
