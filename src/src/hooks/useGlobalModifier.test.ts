// Tier-1 hook test for `useGlobalModifier`.
//
// Behaviour we care about:
//   - `keydown` with `ctrlKey` flips the shared flag on
//   - `keydown` with `metaKey` (Cmd on Mac) does the same
//   - `keydown` with neither leaves the flag off (regression pin:
//     a plain letter press shouldn't trigger ShortcutTooltip)
//   - `keyup` that releases the modifier clears the flag
//   - `blur` on the window clears the flag so a tooltip doesn't
//     get stuck open after the user alt-tabs away
//   - unmounting removes its listeners so two mounted hooks
//     don't fight
//
// `renderHook` from `@testing-library/react` needs a DOM, so this
// file opts into the jsdom environment via the directive below.

// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGlobalModifier } from "./useGlobalModifier";
import { useShortcutModifierStore } from "../zustand/useShortcutModifierStore";

const press = (init: KeyboardEventInit): KeyboardEvent =>
  new KeyboardEvent("keydown", init);

const release = (init: KeyboardEventInit): KeyboardEvent =>
  new KeyboardEvent("keyup", init);

const dispatchOnWindow = (event: KeyboardEvent | FocusEvent): void => {
  act(() => {
    window.dispatchEvent(event);
  });
};

const flag = (): boolean =>
  useShortcutModifierStore.getState().isModifierPressed;

// The shared setup's afterEach snapshots-and-restores which keeps
// the *final* state across tests; we want a clean slate each time.
const resetFlag = (): void => {
  useShortcutModifierStore.setState({ isModifierPressed: false });
};

describe("useGlobalModifier", () => {
  beforeEach(() => {
    resetFlag();
  });

  it("flips the flag on when Ctrl is pressed", () => {
    renderHook(() => useGlobalModifier());
    expect(flag()).toBe(false);

    dispatchOnWindow(press({ key: "k", ctrlKey: true }));
    expect(flag()).toBe(true);
  });

  it("flips the flag on when Meta (Cmd) is pressed", () => {
    renderHook(() => useGlobalModifier());
    dispatchOnWindow(press({ key: "k", metaKey: true }));
    expect(flag()).toBe(true);
  });

  it("does not flip the flag on a plain letter press", () => {
    renderHook(() => useGlobalModifier());
    dispatchOnWindow(press({ key: "k" }));
    expect(flag()).toBe(false);
  });

  it("clears the flag on keyup once neither modifier is held", () => {
    renderHook(() => useGlobalModifier());
    dispatchOnWindow(press({ key: "k", ctrlKey: true }));
    expect(flag()).toBe(true);

    dispatchOnWindow(release({ key: "k", ctrlKey: false, metaKey: false }));
    expect(flag()).toBe(false);
  });

  it("clears the flag when the window loses focus", () => {
    renderHook(() => useGlobalModifier());
    dispatchOnWindow(press({ key: "k", ctrlKey: true }));
    expect(flag()).toBe(true);

    act(() => {
      window.dispatchEvent(new FocusEvent("blur"));
    });
    expect(flag()).toBe(false);
  });

  it("unmounting removes the listeners", () => {
    const { unmount } = renderHook(() => useGlobalModifier());
    unmount();

    dispatchOnWindow(press({ key: "k", ctrlKey: true }));
    expect(flag()).toBe(false);
  });
});
