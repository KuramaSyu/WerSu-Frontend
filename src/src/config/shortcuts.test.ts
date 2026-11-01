import { describe, expect, it } from "vitest";
import {
  getRelevantShortcutPageIds,
  getShortcutPageIdForPath,
  hasLocalEscapeOverride,
  matchesShortcutPath,
} from "./shortcuts";

describe("matchesShortcutPath", () => {
  it("treats 'everywhere' as a match for any path", () => {
    expect(matchesShortcutPath("everywhere", "/anything")).toBe(true);
  });

  it("only matches '/' for the home page", () => {
    expect(matchesShortcutPath("/", "/")).toBe(true);
    expect(matchesShortcutPath("/", "/settings")).toBe(false);
  });

  it("matches ':param' segments", () => {
    expect(matchesShortcutPath("/n/:id", "/n/abc")).toBe(true);
    expect(matchesShortcutPath("/n/:id", "/n/abc/extra")).toBe(true);
    expect(matchesShortcutPath("/n/:id", "/n")).toBe(false);
    expect(matchesShortcutPath("/n/:id", "/d/abc")).toBe(false);
  });
});

describe("getShortcutPageIdForPath", () => {
  it("resolves the home, note, and directory pages", () => {
    expect(getShortcutPageIdForPath("/")).toBe("home");
    expect(getShortcutPageIdForPath("/n/abc")).toBe("note");
    expect(getShortcutPageIdForPath("/d/abc")).toBe("directory");
    expect(getShortcutPageIdForPath("/d/abc/edit")).toBe("directory");
  });

  it("returns null for a route with no page entry", () => {
    expect(getShortcutPageIdForPath("/settings")).toBeNull();
  });
});

describe("getRelevantShortcutPageIds", () => {
  it("puts the active page first, then global", () => {
    expect(getRelevantShortcutPageIds("/d/abc")).toEqual([
      "directory",
      "global",
    ]);
  });

  it("falls back to global alone on an unconfigured route", () => {
    expect(getRelevantShortcutPageIds("/settings")).toEqual(["global"]);
  });
});

describe("hasLocalEscapeOverride", () => {
  const state = (
    viewMode: "source" | "rich",
    editMode: boolean,
    readOnly = false,
  ) => ({ viewMode, editMode, readOnly });

  it("is false on the note page in read mode", () => {
    expect(hasLocalEscapeOverride("note", state("rich", false))).toBe(false);
  });

  it("is true on the note page in source mode", () => {
    expect(hasLocalEscapeOverride("note", state("source", true))).toBe(true);
  });

  it("is true on the note page in insert mode", () => {
    expect(hasLocalEscapeOverride("note", state("rich", true))).toBe(true);
  });

  it("is false on the note page in read-only insert mode", () => {
    expect(
      hasLocalEscapeOverride("note", state("rich", true, true)),
    ).toBe(false);
  });

  it("is false on pages without a local Escape or with no page", () => {
    expect(hasLocalEscapeOverride("home", state("rich", true))).toBe(false);
    expect(hasLocalEscapeOverride(null, state("rich", true))).toBe(false);
  });
});
