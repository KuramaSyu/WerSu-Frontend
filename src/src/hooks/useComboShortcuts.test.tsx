// @vitest-environment jsdom

import "../test/setup";

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useComboShortcuts } from "./useComboShortcuts";

const press = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

describe("useComboShortcuts", () => {
  it("fires the global Ctrl+/ handler", () => {
    const onOpen = vi.fn();
    renderHook(() =>
      useComboShortcuts("global", { "global.shortcutsModal": onOpen }),
    );

    press({ key: "/", ctrlKey: true });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("preventDefaults the matched combo", () => {
    const onOpen = vi.fn();
    renderHook(() =>
      useComboShortcuts("global", { "global.shortcutsModal": onOpen }),
    );

    const event = press({ key: "/", ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores the key without a modifier", () => {
    const onOpen = vi.fn();
    renderHook(() =>
      useComboShortcuts("global", { "global.shortcutsModal": onOpen }),
    );

    press({ key: "/" });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does nothing while disabled", () => {
    const onOpen = vi.fn();
    renderHook(() =>
      useComboShortcuts("global", { "global.shortcutsModal": onOpen }, false),
    );

    press({ key: "/", ctrlKey: true });

    expect(onOpen).not.toHaveBeenCalled();
  });
});
