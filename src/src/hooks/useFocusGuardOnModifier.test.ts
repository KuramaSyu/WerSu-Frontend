// Tier-1 hook test for `useFocusGuardOnModifier`.
//
// Regression pin: pressing Ctrl/Cmd used to yank focus out of
// whatever the user was typing in. The store update from
// `useGlobalModifier` re-renders every `ShortcutHint`, and
// the resulting DOM mutations could shift focus. The guard
// snapshots `document.activeElement` on the 0 -> 1 transition
// and restores focus in a microtask.
//
// Notes:
//
//   - jsdom ignores `focus()` calls to elements without an
//     explicit `tabIndex`. Every "second" element here gets
//     `tabindex="-1"` so the tests can deterministically
//     shift focus.
//
// `renderHook` from `@testing-library/react` needs a DOM, so
// this file opts into the jsdom environment via the directive
// below.

// @vitest-environment jsdom

import "../test/setup";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFocusGuardOnModifier } from "./useFocusGuardOnModifier";
import { useShortcutModifierStore } from "../zustand/useShortcutModifierStore";

const resetFlag = (): void => {
  useShortcutModifierStore.setState({ isModifierPressed: false });
};

const setFlag = (value: boolean): void => {
  act(() => {
    useShortcutModifierStore.setState({ isModifierPressed: value });
  });
};

// Drain the React commit, the effect's `useEffect`, and the
// `queueMicrotask` it schedules -- three microtask hops
// before assertions are reliable.
const flushAll = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const makeFocusable = (tag: "input" | "div"): HTMLElement => {
  const el = document.createElement(tag);
  el.setAttribute("tabindex", "-1");
  document.body.appendChild(el);
  return el;
};

describe("useFocusGuardOnModifier", () => {
  beforeEach(() => {
    resetFlag();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    resetFlag();
    document.body.innerHTML = "";
  });

  it("restores focus to the input element on a 0 -> 1 transition", async () => {
    renderHook(() => useFocusGuardOnModifier());

    const input = makeFocusable("input") as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    setFlag(true);
    await flushAll();

    expect(document.activeElement).toBe(input);
  });

  it("does nothing when no element was active on the rising edge", async () => {
    renderHook(() => useFocusGuardOnModifier());

    expect(document.activeElement).toBe(document.body);

    setFlag(true);
    await flushAll();

    expect(document.activeElement).toBe(document.body);
  });

  it("does not re-focus on a 1 -> 0 transition (modifier release)", async () => {
    renderHook(() => useFocusGuardOnModifier());

    const input = makeFocusable("input") as HTMLInputElement;
    input.focus();

    setFlag(true);
    await flushAll();
    expect(document.activeElement).toBe(input);

    // Steal focus to a different focusable; the falling
    // edge must NOT pull it back to the captured input.
    const other = makeFocusable("div");
    other.focus();
    expect(document.activeElement).toBe(other);

    setFlag(false);
    await flushAll();

    expect(document.activeElement).toBe(other);
  });

  it("does not re-focus an element that has been unmounted", async () => {
    renderHook(() => useFocusGuardOnModifier());

    const input = makeFocusable("input") as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    // Tear down the captured target BEFORE the rising edge
    // flip -- the guard must no-op when the snapshot no
    // longer belongs to the document.
    input.remove();

    setFlag(true);
    await flushAll();

    expect(document.activeElement).toBe(document.body);
  });

  it("only triggers on the rising edge, not on every render while held", async () => {
    const { rerender } = renderHook(() => useFocusGuardOnModifier());

    const input = makeFocusable("input") as HTMLInputElement;
    input.focus();

    setFlag(true);
    await flushAll();
    expect(document.activeElement).toBe(input);

    // Steal focus; a no-op rerender of the hook must not
    // re-focus us back, because deps haven't changed
    // (`isModifierPressed` is still `true`).
    const other = makeFocusable("div");
    other.focus();
    expect(document.activeElement).toBe(other);

    act(() => {
      rerender();
    });
    await flushAll();

    expect(document.activeElement).toBe(other);
  });
});
