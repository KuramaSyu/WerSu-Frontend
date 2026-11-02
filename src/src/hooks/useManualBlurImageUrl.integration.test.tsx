// @vitest-environment jsdom

import "../test/setup";

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchImageBlob = vi.fn();
// Keep the real `blurImageToWebp`; only stub the network read so the canvas
// pipeline actually runs.
vi.mock("../utils/imageBlur", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/imageBlur")>()),
  fetchImageBlob: (...args: unknown[]) => fetchImageBlob(...args),
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

const blurEvents: string[] = [];

describe("useManualBlurImageUrl (real canvas pipeline)", () => {
  beforeEach(() => {
    fetchImageBlob.mockReset();
    blurEvents.length = 0;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: () => "blob:manual",
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: () => undefined,
    });

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({
        width: 1200,
        height: 800,
        close: () => undefined,
      })),
    );

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag !== "canvas") {
        return originalCreateElement(tag);
      }
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          filter: "",
          drawImage: () => blurEvents.push("draw"),
        }),
        toBlob: (cb: (b: Blob | null) => void) => {
          blurEvents.push("toBlob");
          cb(new Blob(["blurred"], { type: "image/webp" }));
        },
      };
      return canvas as unknown as HTMLCanvasElement;
    });

    useImageBlobCacheStore.setState({
      byUrl: new Map(),
      inflight: new Map(),
      hydrated: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("runs the canvas blur for a fetched source", async () => {
    fetchImageBlob.mockResolvedValue(
      new Blob(["sharp"], { type: "image/webp" }),
    );

    const { result } = renderHook(() =>
      useManualBlurImageUrl(
        "/api/attachments/image?width=720&format=webp&key=attachments%252Fabc",
        33,
      ),
    );

    await waitFor(() => expect(result.current).toBe("blob:manual"));
    expect(blurEvents).toEqual(["draw", "toBlob"]);
  });
});
