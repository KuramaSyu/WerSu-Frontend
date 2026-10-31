// Tier-1 tests for the width-mode transition controller.
//
// The contract:
//   - normal/wide transitions never touch the panels;
//   - entering `full` snaps the user's current panel layout, pins the
//     user-override flags and collapses both panels;
//   - leaving `full` restores the snapped layout (open flags *and*
//     overrides) so the user's previous panel arrangement comes back;
//   - the snapshot is captured at entry, so a later layout change while
//     in `full` can't corrupt what gets restored.
//
// `LayoutProvider` is mocked so this stays a pure logic test and
// doesn't pull MUI into the environment.

// @vitest-environment jsdom

import "../../../test/setup";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useViewConfig } from "../../../zustand/useViewConfig";
import { useNoteWidthMode } from "./useNoteWidthMode";

const layout = vi.hoisted(() => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  leftPanelUserOverride: false,
  rightPanelUserOverride: false,
  setLeftPanelOpen: vi.fn(),
  setRightPanelOpen: vi.fn(),
  setLeftPanelUserOverride: vi.fn(),
  setRightPanelUserOverride: vi.fn(),
}));

vi.mock("../../../LayoutProvider", () => ({
  useLayout: () => layout,
}));

beforeEach(() => {
  useViewConfig.getState().resetViewConfig();
  layout.leftPanelOpen = true;
  layout.rightPanelOpen = true;
  layout.leftPanelUserOverride = false;
  layout.rightPanelUserOverride = false;
  vi.clearAllMocks();
});

const cycle = (result: { current: { cycleWidthMode: () => void } }) => {
  act(() => result.current.cycleWidthMode());
};

describe("useNoteWidthMode", () => {
  it("advances normal -> wide without touching the panels", () => {
    const { result } = renderHook(() => useNoteWidthMode());

    cycle(result);

    expect(useViewConfig.getState().config.widthMode).toBe("wide");
    expect(layout.setLeftPanelOpen).not.toHaveBeenCalled();
    expect(layout.setRightPanelOpen).not.toHaveBeenCalled();
    expect(layout.setLeftPanelUserOverride).not.toHaveBeenCalled();
    expect(layout.setRightPanelUserOverride).not.toHaveBeenCalled();
  });

  it("entering full collapses both panels and pins the overrides", () => {
    useViewConfig.getState().setViewConfig({ widthMode: "wide" });
    const { result } = renderHook(() => useNoteWidthMode());

    cycle(result);

    expect(useViewConfig.getState().config.widthMode).toBe("full");
    expect(layout.setLeftPanelOpen).toHaveBeenCalledWith(false);
    expect(layout.setRightPanelOpen).toHaveBeenCalledWith(false);
    expect(layout.setLeftPanelUserOverride).toHaveBeenCalledWith(true);
    expect(layout.setRightPanelUserOverride).toHaveBeenCalledWith(true);
  });

  it("leaving full restores the layout captured at entry", () => {
    // User had manually closed the left panel and left the right open.
    layout.leftPanelOpen = false;
    layout.rightPanelOpen = true;
    layout.leftPanelUserOverride = true;
    layout.rightPanelUserOverride = false;

    const { result } = renderHook(() => useNoteWidthMode());

    // normal -> wide -> full (captures) -> normal (restores)
    cycle(result); // wide
    cycle(result); // full
    vi.clearAllMocks();
    cycle(result); // normal

    expect(useViewConfig.getState().config.widthMode).toBe("normal");
    expect(layout.setLeftPanelOpen).toHaveBeenCalledWith(false);
    expect(layout.setRightPanelOpen).toHaveBeenCalledWith(true);
    expect(layout.setLeftPanelUserOverride).toHaveBeenCalledWith(true);
    expect(layout.setRightPanelUserOverride).toHaveBeenCalledWith(false);
  });

  it("wraps full -> normal -> wide", () => {
    useViewConfig.getState().setViewConfig({ widthMode: "full" });
    const { result } = renderHook(() => useNoteWidthMode());

    cycle(result); // full -> normal
    expect(useViewConfig.getState().config.widthMode).toBe("normal");

    cycle(result); // normal -> wide
    expect(useViewConfig.getState().config.widthMode).toBe("wide");
  });
});
