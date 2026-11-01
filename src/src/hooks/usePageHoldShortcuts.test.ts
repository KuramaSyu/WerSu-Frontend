// @vitest-environment jsdom

import "../test/setup";

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePageHoldShortcuts } from "./usePageHoldShortcuts";

describe("usePageHoldShortcuts", () => {
  it("resolves the home page's hold actions in catalogue order", () => {
    const { result } = renderHook(() =>
      usePageHoldShortcuts("home", {}),
    );

    expect(result.current.map((action) => action.label)).toEqual([
      "New directory",
      "New note",
      "Search",
      "Navigate back",
    ]);
    expect(result.current.map((action) => action.key)).toEqual([
      "d",
      "n",
      "k",
      "Escape",
    ]);
  });

  it("includes the directory-only edit action", () => {
    const { result } = renderHook(() =>
      usePageHoldShortcuts("directory", {}),
    );

    expect(result.current.map((action) => action.label)).toEqual([
      "New directory",
      "New note",
      "Search",
      "Edit this directory",
      "Navigate back",
    ]);
  });

  it("lets Escape arm from text fields only", () => {
    const { result } = renderHook(() =>
      usePageHoldShortcuts("home", {}),
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
