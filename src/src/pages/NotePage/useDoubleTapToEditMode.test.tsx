// @vitest-environment jsdom

import "../../test/setup";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { useDoubleTapToEditMode } from "./useDoubleTapToEditMode";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useViewConfig } from "../../zustand/useViewConfig";

const breakpoint = vi.hoisted(() => ({ isMobile: true }));

vi.mock("../../hooks/useBreakpoint", () => ({
  useBreakpoint: () => ({
    isMobile: breakpoint.isMobile,
    isTablet: false,
    isDesktop: !breakpoint.isMobile,
    isXL: false,
  }),
}));

function makeEvent(
  overrides: Partial<{ defaultPrevented: boolean; target: unknown }> = {},
) {
  return {
    preventDefault: vi.fn(),
    defaultPrevented: false,
    target: null,
    ...overrides,
  } as unknown as MouseEvent;
}

describe("useDoubleTapToEditMode", () => {
  beforeEach(() => {
    breakpoint.isMobile = true;
  });

  it("swaps into write mode when read mode is active on mobile", () => {
    useEditorSettings.setState({ editMode: false });
    useViewConfig.setState({ config: { readOnly: false, widthMode: "normal" } });

    const { result } = renderHook(() => useDoubleTapToEditMode());
    const event = makeEvent();
    result.current(event);

    expect(useEditorSettings.getState().editMode).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("is a no-op on desktop so double click keeps selecting text", () => {
    breakpoint.isMobile = false;
    useEditorSettings.setState({ editMode: false });
    useViewConfig.setState({ config: { readOnly: false, widthMode: "normal" } });

    const { result } = renderHook(() => useDoubleTapToEditMode());
    const event = makeEvent();
    result.current(event);

    expect(useEditorSettings.getState().editMode).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("is a no-op while already editing", () => {
    useEditorSettings.setState({ editMode: true });
    useViewConfig.setState({ config: { readOnly: false, widthMode: "normal" } });

    const { result } = renderHook(() => useDoubleTapToEditMode());
    const event = makeEvent();
    result.current(event);

    expect(useEditorSettings.getState().editMode).toBe(true);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("respects a child that already handled the double click", () => {
    useEditorSettings.setState({ editMode: false });
    useViewConfig.setState({ config: { readOnly: false, widthMode: "normal" } });

    const { result } = renderHook(() => useDoubleTapToEditMode());
    result.current(makeEvent({ defaultPrevented: true }));

    expect(useEditorSettings.getState().editMode).toBe(false);
  });

  it("does not enter write mode on a read-only share", () => {
    useEditorSettings.setState({ editMode: false });
    useViewConfig.setState({ config: { readOnly: true, widthMode: "normal" } });

    const { result } = renderHook(() => useDoubleTapToEditMode());
    const event = makeEvent();
    result.current(event);

    expect(useEditorSettings.getState().editMode).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
