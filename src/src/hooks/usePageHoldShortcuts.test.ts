// @vitest-environment jsdom

import "../test/setup";

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePageHoldShortcuts } from "./usePageHoldShortcuts";

describe("usePageHoldShortcuts", () => {
  it("resolves the global page's hold actions in catalogue order", () => {
    const { result } = renderHook(() => usePageHoldShortcuts("global", {}));

    expect(result.current.map((action) => action.label)).toEqual([
      "Search",
      "Go home",
      "Navigate back",
    ]);
    expect(result.current.map((action) => action.key)).toEqual([
      "k",
      "h",
      "Escape",
    ]);
  });

  it("resolves the home page's hold actions in catalogue order", () => {
    const { result } = renderHook(() => usePageHoldShortcuts("home", {}));

    expect(result.current.map((action) => action.label)).toEqual([
      "New directory",
      "New note",
    ]);
    expect(result.current.map((action) => action.key)).toEqual(["d", "n"]);
  });

  it("includes the directory-only edit action", () => {
    const { result } = renderHook(() =>
      usePageHoldShortcuts("directory", {}),
    );

    expect(result.current.map((action) => action.label)).toEqual([
      "New directory",
      "New note",
      "Edit this directory",
    ]);
  });

  it("lets Escape arm from text fields only", () => {
    const { result } = renderHook(() =>
      usePageHoldShortcuts("global", {}),
    );

    const escape = result.current.find((action) => action.key === "Escape");
    const letters = result.current.filter((action) => action.key !== "Escape");
    expect(escape?.allowInTextFields).toBe(true);
    expect(letters.every((action) => !action.allowInTextFields)).toBe(true);
  });

  it("invokes the matching handler when an action fires", () => {
    const onEdit = vi.fn();
    const { result } = renderHook(() =>
      usePageHoldShortcuts("directory", { "directory.edit": onEdit }),
    );

    act(() => {
      result.current
        .find((action) => action.key === "e")
        ?.onTrigger();
    });

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list for an unknown page", () => {
    const { result } = renderHook(() =>
      usePageHoldShortcuts("nope", {}),
    );

    expect(result.current).toEqual([]);
  });
});
