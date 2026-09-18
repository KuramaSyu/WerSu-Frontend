// Tier-1 hook test for `useTopPanelScrollVisibility` and
// `useTopPanelHoverShow`. Pinned behaviour:
//   - default (enabled): scrolling down hides, scrolling up shows
//   - enabled=false: the scroll listener never fires and any prior
//     hidden state is forced back to visible
//   - hover hook: a mousemove into the top strip re-reveals the panel
//   - hover hook: disabled mode never attaches a listener

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  computeNextShowPanel,
  TOP_PANEL_HOVER_REVEAL_PX,
  useTopPanelHoverShow,
  useTopPanelScrollVisibility,
} from "./useTopPanelScrollVisibility";

const dispatchScroll = (element: HTMLElement, top: number): void => {
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    value: top,
  });
  act(() => {
    element.dispatchEvent(new Event("scroll"));
  });
};

const makeScrollElement = (): HTMLElement => {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollTop", { configurable: true, value: 0 });
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    value: 1000,
  });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: 500 });
  document.body.appendChild(el);
  return el;
};

describe("computeNextShowPanel", () => {
  it("hides on downward scroll past the top threshold", () => {
    expect(computeNextShowPanel(200, 0)).toBe(false);
  });

  it("ignores tiny deltas (trackpad jitter)", () => {
    expect(computeNextShowPanel(50, 49)).toBeNull();
  });

  it("shows on upward scroll", () => {
    expect(computeNextShowPanel(100, 200)).toBe(true);
  });

  it("suppresses rubber-band overscroll at the bottom edge", () => {
    expect(computeNextShowPanel(495, 500, 24, 4, 500)).toBeNull();
  });
});

describe("useTopPanelScrollVisibility", () => {
  let element: HTMLElement;
  let setShowPanel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    element = makeScrollElement();
    setShowPanel = vi.fn();
  });

  afterEach(() => {
    element.remove();
  });

  it("hides on downward scroll", () => {
    renderHook(() => useTopPanelScrollVisibility(element, setShowPanel));
    dispatchScroll(element, 200);
    expect(setShowPanel).toHaveBeenLastCalledWith(false);
  });

  it("ignores `enabled=false`: never attaches a listener", () => {
    const addSpy = vi.spyOn(element, "addEventListener");
    renderHook(() => useTopPanelScrollVisibility(element, setShowPanel, false));
    expect(addSpy).not.toHaveBeenCalledWith("scroll", expect.anything());
    addSpy.mockRestore();
  });

  it("forces the panel visible when `enabled` flips to false", () => {
    const { rerender } = renderHook(
      ({ enabled }) =>
        useTopPanelScrollVisibility(element, setShowPanel, enabled),
      { initialProps: { enabled: true } },
    );
    setShowPanel.mockClear();
    rerender({ enabled: false });
    expect(setShowPanel).toHaveBeenCalledWith(true);
  });
});

describe("useTopPanelHoverShow", () => {
  let setShowPanel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setShowPanel = vi.fn();
  });

  const dispatchMouseMove = (clientY: number): void => {
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientY }));
    });
  };

  it("reveals the panel when the cursor enters the top strip", () => {
    renderHook(() => useTopPanelHoverShow(setShowPanel, true));
    dispatchMouseMove(TOP_PANEL_HOVER_REVEAL_PX - 1);
    expect(setShowPanel).toHaveBeenCalledWith(true);
  });

  it("does nothing when the cursor is below the strip", () => {
    renderHook(() => useTopPanelHoverShow(setShowPanel, true));
    dispatchMouseMove(TOP_PANEL_HOVER_REVEAL_PX + 50);
    expect(setShowPanel).not.toHaveBeenCalled();
  });

  it("does not attach a listener when disabled", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => useTopPanelHoverShow(setShowPanel, false));
    expect(addSpy).not.toHaveBeenCalledWith("mousemove", expect.anything());
    addSpy.mockRestore();
  });

  it("respects a custom reveal height", () => {
    renderHook(() => useTopPanelHoverShow(setShowPanel, true, 100));
    dispatchMouseMove(80);
    expect(setShowPanel).toHaveBeenCalledWith(true);
  });

  it("only fires once per outside-to-inside crossing", () => {
    // Without the edge-crossing gate, every mousemove inside the top
    // strip calls setShowPanel(true), which produces a fresh
    // LayoutContext value object even when the value didn't change and
    // re-renders every useLayout() consumer (e.g. the note editor) per
    // frame. The hook should reveal on entry and stay silent until the
    // cursor leaves and re-enters the strip.
    renderHook(() => useTopPanelHoverShow(setShowPanel, true));
    dispatchMouseMove(TOP_PANEL_HOVER_REVEAL_PX - 1);
    dispatchMouseMove(TOP_PANEL_HOVER_REVEAL_PX - 2);
    dispatchMouseMove(TOP_PANEL_HOVER_REVEAL_PX - 3);
    expect(setShowPanel).toHaveBeenCalledTimes(1);
    dispatchMouseMove(TOP_PANEL_HOVER_REVEAL_PX + 100);
    dispatchMouseMove(TOP_PANEL_HOVER_REVEAL_PX - 1);
    expect(setShowPanel).toHaveBeenCalledTimes(2);
  });
});
