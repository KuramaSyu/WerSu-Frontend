// Tests for the Ctrl/Meta modifier matcher.
//
// Behaviour we care about:
//   - `isCtrlPlus(event, "k")` is true only when ctrl OR meta is
//     held alongside `event.key === "k"` (case-insensitive).
//   - `isCtrlPlus(event, ["q", "w", "e"])` matches when any key
//     in the array is pressed; any non-matching key returns false.
//   - Without a modifier, even a matching key returns false.
//   - A non-matching modifier (Alt only) returns false.
//   - `isCtrlPlus(event, key, { alt: true })` additionally
//     requires Alt, and rejects plain-ctrl so it can back the
//     Ctrl+Alt+N / Ctrl+Alt+D / Ctrl+Alt+Q/W/E bindings.
//
// Pure helper, no React. Runs under jsdom so `KeyboardEvent` is
// constructible.

// @vitest-environment jsdom

import "../test/setup";

import { describe, expect, it } from "vitest";

import { isCtrlPlus } from "./CtrlPlus";

const k = (
  init: KeyboardEventInit & {
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
  },
): KeyboardEvent => new KeyboardEvent("keydown", init);

describe("isCtrlPlus (string key)", () => {
  it("matches ctrl+key", () => {
    expect(isCtrlPlus(k({ key: "k", ctrlKey: true }), "k")).toBe(true);
  });

  it("matches meta+key (Mac Cmd)", () => {
    expect(isCtrlPlus(k({ key: "k", metaKey: true }), "k")).toBe(true);
  });

  it("is case-insensitive on the target key", () => {
    expect(isCtrlPlus(k({ key: "K", ctrlKey: true }), "k")).toBe(true);
    expect(isCtrlPlus(k({ key: "k", ctrlKey: true }), "K")).toBe(true);
  });

  it("returns false when no modifier is held", () => {
    expect(isCtrlPlus(k({ key: "k" }), "k")).toBe(false);
  });

  it("returns false for a different key", () => {
    expect(isCtrlPlus(k({ key: "j", ctrlKey: true }), "k")).toBe(false);
  });
});

describe("isCtrlPlus (array of keys)", () => {
  it("matches any of the supplied keys", () => {
    const targets = ["q", "w", "e"];
    for (const key of targets) {
      expect(isCtrlPlus(k({ key, ctrlKey: true }), targets)).toBe(true);
    }
  });

  it("returns false when the pressed key isn't in the array", () => {
    expect(isCtrlPlus(k({ key: "r", ctrlKey: true }), ["q", "w", "e"])).toBe(
      false,
    );
  });

  it("returns false when no modifier is held", () => {
    expect(isCtrlPlus(k({ key: "q" }), ["q", "w", "e"])).toBe(false);
  });

  it("case-insensitive against array entries", () => {
    expect(isCtrlPlus(k({ key: "Q", ctrlKey: true }), ["q", "w", "e"])).toBe(
      true,
    );
  });

  it("works with the meta modifier too", () => {
    expect(isCtrlPlus(k({ key: "w", metaKey: true }), ["q", "w", "e"])).toBe(
      true,
    );
  });

  it("treats an empty array as no match", () => {
    expect(isCtrlPlus(k({ key: "q", ctrlKey: true }), [])).toBe(false);
  });
});

describe("isCtrlPlus ({ alt: true })", () => {
  // The Ctrl+Alt+Q/W/E bindings depend on these guards -- if
  // any of these silently pass, a plain Ctrl+E press would
  // also fire the strategy selector and we'd be back to the
  // collision-with-Ctrl-W / Ctrl-E behaviour we are trying to
  // avoid.

  it("matches ctrl+alt+key (string form)", () => {
    expect(
      isCtrlPlus(k({ key: "n", ctrlKey: true, altKey: true }), "n", {
        alt: true,
      }),
    ).toBe(true);
  });

  it("matches meta+alt+key on Mac", () => {
    expect(
      isCtrlPlus(k({ key: "n", metaKey: true, altKey: true }), "n", {
        alt: true,
      }),
    ).toBe(true);
  });

  it("rejects plain ctrl when alt is required", () => {
    // The whole point of the Ctrl+Alt combos: ctrl+n without
    // alt must NOT match, otherwise Firefox's "new window" key
    // would still trigger our app handler.
    expect(isCtrlPlus(k({ key: "n", ctrlKey: true }), "n", { alt: true })).toBe(
      false,
    );
  });

  it("rejects plain meta when alt is required", () => {
    expect(isCtrlPlus(k({ key: "n", metaKey: true }), "n", { alt: true })).toBe(
      false,
    );
  });

  it("rejects alt only (no ctrl / no meta)", () => {
    expect(isCtrlPlus(k({ key: "n", altKey: true }), "n", { alt: true })).toBe(
      false,
    );
  });

  it("works with the array form", () => {
    const targets = ["q", "w", "e"];
    for (const key of targets) {
      expect(
        isCtrlPlus(k({ key, ctrlKey: true, altKey: true }), targets, {
          alt: true,
        }),
      ).toBe(true);
    }
  });

  it("rejects the array form when only ctrl is held", () => {
    expect(
      isCtrlPlus(k({ key: "q", ctrlKey: true }), ["q", "w", "e"], {
        alt: true,
      }),
    ).toBe(false);
  });
});
