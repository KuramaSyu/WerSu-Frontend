// @vitest-environment jsdom

import "../test/setup";

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyHold, type HoldKeyAction } from "./useKeyHold";

const escapeAction = (
  onTrigger: () => void,
  overrides: Partial<HoldKeyAction> = {},
): HoldKeyAction => ({
  key: "Escape",
  keyLabel: "ESC",
  label: "exit source mode",
  onTrigger,
  ...overrides,
});

describe("useKeyHold", () => {
  it("tracks the held key and fires when completed", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() =>
      useKeyHold({ enabled: true, actions: [escapeAction(onTrigger)] }),
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.holding?.key).toBe("Escape");

    act(() => {
      result.current.complete();
    });

    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(result.current.holding).toBeNull();
  });

  it("does not fire when the key is released early", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() =>
      useKeyHold({ enabled: true, actions: [escapeAction(onTrigger)] }),
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape" }));
    });
    act(() => {
      result.current.complete();
    });

    expect(onTrigger).not.toHaveBeenCalled();
    expect(result.current.holding).toBeNull();
  });

  it("does not arm for a modified keystroke (Cmd+Esc)", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() =>
      useKeyHold({ enabled: true, actions: [escapeAction(onTrigger)] }),
    );

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", metaKey: true }),
      );
    });

    expect(result.current.holding).toBeNull();
  });

  it("cancels the hold when a modifier is pressed mid-hold", () => {
    // macOS suppresses the keyup of the held key once Cmd goes down, so
    // the hold must not survive a modifier press. Otherwise a short
    // Cmd+Esc tap would let the bar fill up and trigger on its own.
    const onTrigger = vi.fn();
    const { result } = renderHook(() =>
      useKeyHold({ enabled: true, actions: [escapeAction(onTrigger)] }),
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.holding?.key).toBe("Escape");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta" }));
    });

    expect(result.current.holding).toBeNull();
    act(() => {
      result.current.complete();
    });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("still cancels on release after the action disappears mid-hold", () => {
    const onTrigger = vi.fn();
    const { result, rerender } = renderHook(
      ({ actions }: { actions: HoldKeyAction[] }) =>
        useKeyHold({ enabled: true, actions }),
      { initialProps: { actions: [escapeAction(onTrigger)] } },
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.holding?.key).toBe("Escape");

    // A `when` condition flipped: the action is no longer advertised.
    act(() => {
      rerender({ actions: [] });
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape" }));
    });

    expect(result.current.holding).toBeNull();
    act(() => {
      result.current.complete();
    });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("ignores auto-repeat and unrelated keys", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() =>
      useKeyHold({ enabled: true, actions: [escapeAction(onTrigger)] }),
    );

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", repeat: true }),
      );
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });

    expect(result.current.holding).toBeNull();
  });

  it("does nothing while disabled", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() =>
      useKeyHold({ enabled: false, actions: [escapeAction(onTrigger)] }),
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(result.current.holding).toBeNull();
    act(() => {
      result.current.complete();
    });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("cancels when the window loses focus", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() =>
      useKeyHold({ enabled: true, actions: [escapeAction(onTrigger)] }),
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(result.current.holding).toBeNull();
  });

  it("ignores letter shortcuts while a text field is focused", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() =>
      useKeyHold({
        enabled: true,
        actions: [
          { key: "i", keyLabel: "I", label: "insert", onTrigger },
        ],
      }),
    );
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "i", bubbles: true }),
      );
    });

    expect(result.current.holding).toBeNull();
    input.remove();
  });

  it("allows Esc-style actions while a text field is focused", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() =>
      useKeyHold({
        enabled: true,
        actions: [
          escapeAction(onTrigger, { allowInTextFields: true }),
        ],
      }),
    );
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(result.current.holding?.key).toBe("Escape");
    input.remove();
  });

  it("capture mode observes the key before a descendant can stop it", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() =>
      useKeyHold({
        enabled: true,
        capture: true,
        actions: [escapeAction(onTrigger)],
      }),
    );
    const child = document.createElement("div");
    document.body.appendChild(child);
    child.addEventListener("keydown", (event) => event.stopPropagation());

    act(() => {
      child.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(result.current.holding?.key).toBe("Escape");
    child.remove();
  });

  it("bubble mode lets a descendant consume the key first", () => {
    const { result } = renderHook(() =>
      useKeyHold({
        enabled: true,
        capture: false,
        actions: [escapeAction(vi.fn())],
      }),
    );
    const child = document.createElement("div");
    document.body.appendChild(child);
    child.addEventListener("keydown", (event) => event.stopPropagation());

    act(() => {
      child.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(result.current.holding).toBeNull();
    child.remove();
  });
});
