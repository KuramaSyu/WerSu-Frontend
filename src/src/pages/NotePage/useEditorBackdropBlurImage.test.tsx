// @vitest-environment jsdom

import "../../test/setup";

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const blurMock = vi.hoisted(() => vi.fn());
vi.mock("../../utils/imageBlur", () => ({
  blurImageToViewportWebp: (...args: unknown[]) => blurMock(...args),
}));

import { useEditorBackdropBlurImage } from "./useEditorBackdropBlurImage";
import { useThemeBackgroundStore } from "../../zustand/useThemeBackgroundStore";

describe("useEditorBackdropBlurImage", () => {
  beforeEach(() => {
    blurMock.mockReset();
    useThemeBackgroundStore.getState().setResolvedUrl(null);
  });

  it("bakes the resolved theme background for the current viewport", async () => {
    const blob = new Blob(["blurred"], { type: "image/webp" });
    blurMock.mockResolvedValue({
      blob,
      width: 1024,
      height: 768,
      offsetX: 24,
      offsetY: 24,
    });
    useThemeBackgroundStore.getState().setResolvedUrl("blob:source");

    const { result } = renderHook(() =>
      useEditorBackdropBlurImage(true, 12),
    );

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(blurMock).toHaveBeenCalledWith(
      "blob:source",
      12,
      window.innerWidth,
      window.innerHeight,
    );
    expect(result.current).toMatchObject({
      width: 1024,
      height: 768,
      offsetX: 24,
      offsetY: 24,
    });
  });

  it("does nothing while disabled", () => {
    useThemeBackgroundStore.getState().setResolvedUrl("blob:source");

    renderHook(() => useEditorBackdropBlurImage(false, 12));

    expect(blurMock).not.toHaveBeenCalled();
  });
});
