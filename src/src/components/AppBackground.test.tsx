// @vitest-environment jsdom

import "../test/setup";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockTheme {
  custom: {
    backgroundImages: string[];
    chosenBackgroundImage: string | null;
    blur: number;
  };
  palette: { background: { default: string } };
}

const manualMock = vi.hoisted(() => vi.fn());
const cachedMock = vi.hoisted(() => vi.fn());
const themeRef = vi.hoisted((): { current: MockTheme } => ({
  current: {
    custom: {
      backgroundImages: ["https://example.com/sharp.webp"],
      chosenBackgroundImage: "local:blur",
      blur: 33,
    },
    palette: { background: { default: "#101010" } },
  },
}));

vi.mock("../zustand/useThemeStore", () => ({
  useThemeStore: () => ({ theme: themeRef.current }),
}));
vi.mock("../hooks/useCachedImageUrl", () => ({
  useCachedImageUrl: (...args: unknown[]) => cachedMock(...args),
}));
vi.mock("../hooks/useManualBlurImageUrl", () => ({
  useManualBlurImageUrl: (...args: unknown[]) => manualMock(...args),
}));

import AppBackground from "./AppBackground";
import { FeatureFlagName, useFeatureStore } from "../zustand/FeatureStore";
import { useThemeBackgroundStore } from "../zustand/useThemeBackgroundStore";

describe("AppBackground", () => {
  beforeEach(() => {
    manualMock.mockReset();
    cachedMock.mockReset();
    cachedMock.mockReturnValue(null);
    themeRef.current = {
      custom: {
        backgroundImages: ["https://example.com/sharp.webp"],
        chosenBackgroundImage: "local:blur",
        blur: 33,
      },
      palette: { background: { default: "#101010" } },
    };
    useFeatureStore
      .getState()
      .setFlag(FeatureFlagName.PreRenderThemeBlur, true);
    useFeatureStore.getState().setFlag(FeatureFlagName.DisableBlur, false);
    useFeatureStore
      .getState()
      .setFlag(FeatureFlagName.IgnoreBackgroundImage, false);
  });

  it("uses the manual blur source when pre-rendering is off", () => {
    useFeatureStore
      .getState()
      .setFlag(FeatureFlagName.PreRenderThemeBlur, false);
    manualMock.mockReturnValue("blob:manual");

    const { container } = render(<AppBackground />);

    expect(manualMock).toHaveBeenCalledWith(
      "https://example.com/sharp.webp",
      33,
    );
    expect(container.querySelectorAll("div").length).toBeGreaterThan(1);
  });

  it("reads the pre-rendered variant when pre-rendering is on", () => {
    cachedMock.mockReturnValue("blob:prerendered");

    const { container } = render(<AppBackground />);

    expect(cachedMock).toHaveBeenCalledWith("local:blur");
    expect(container.querySelectorAll("div").length).toBeGreaterThan(1);
  });

  it("never renders the sharp source for an unrendered blur", () => {
    themeRef.current = {
      custom: {
        backgroundImages: ["https://example.com/sharp.webp"],
        chosenBackgroundImage: null,
        blur: 33,
      },
      palette: { background: { default: "#101010" } },
    };
    cachedMock.mockReturnValue(null);

    const { container } = render(<AppBackground />);

    expect(container.firstChild).toBeNull();
  });

  it("publishes the resolved URL so surfaces can paint a matching backdrop", () => {
    cachedMock.mockReturnValue("blob:prerendered");

    render(<AppBackground />);

    expect(useThemeBackgroundStore.getState().resolvedUrl).toBe(
      "blob:prerendered",
    );
  });

  it("clears the published URL on unmount", () => {
    cachedMock.mockReturnValue("blob:prerendered");

    const { unmount } = render(<AppBackground />);
    unmount();

    expect(useThemeBackgroundStore.getState().resolvedUrl).toBeNull();
  });

  it("disables the blur pipeline and renders the sharp source", () => {
    useFeatureStore.getState().setFlag(FeatureFlagName.DisableBlur, true);
    cachedMock.mockReturnValue("blob:sharp");

    render(<AppBackground />);

    expect(cachedMock).toHaveBeenCalledWith("https://example.com/sharp.webp");
    expect(manualMock).toHaveBeenCalledWith("", 0);
  });

  it("keeps image-derived colours but renders no image when ignored", () => {
    useFeatureStore
      .getState()
      .setFlag(FeatureFlagName.IgnoreBackgroundImage, true);
    cachedMock.mockReturnValue("blob:should-not-render");

    const { container } = render(<AppBackground />);

    expect(container.firstChild).toBeNull();
    expect(cachedMock).toHaveBeenCalledWith("");
    expect(manualMock).toHaveBeenCalledWith("", 0);
    expect(useThemeBackgroundStore.getState().resolvedUrl).toBeNull();
  });

  it("renders the sharp source when blur is off", () => {
    themeRef.current = {
      custom: {
        backgroundImages: ["https://example.com/sharp.webp"],
        chosenBackgroundImage: "https://example.com/sharp.webp",
        blur: 0,
      },
      palette: { background: { default: "#101010" } },
    };
    cachedMock.mockReturnValue("blob:sharp");

    render(<AppBackground />);

    expect(cachedMock).toHaveBeenCalledWith("https://example.com/sharp.webp");
  });
});
