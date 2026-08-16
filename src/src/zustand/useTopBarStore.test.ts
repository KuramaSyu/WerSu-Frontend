// Tier-1 unit test for `useTopBarStore`.
//
// Behaviour we care about:
//   - default state has no slots;
//   - `setSlot(id, Component, order)` registers a slot; a second
//     call with the same id replaces the component reference and
//     order, not adds a second entry;
//   - `setSlot(id, null)` removes the entry;
//   - `removeSlot(id)` is idempotent (missing ids are no-ops);
//   - `selectSortedTopBarSlots` returns entries ordered by ascending
//     `order`, with the original `id` preserved for stable `key`s.
//
// Pure-helper test -- no React tree, no MUI. Stays clear of the
// `@mui/material/styles` ESM-graph landmine documented in `setup.ts`.

// @vitest-environment jsdom

import "../test/setup";

import type { ComponentType } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { selectSortedTopBarSlots, useTopBarStore } from "./useTopBarStore";

const StubA: ComponentType = () => null;
const StubB: ComponentType = () => null;
const StubC: ComponentType = () => null;

// The global reset in `setup.ts` snapshots stores via
// `JSON.stringify`, which drops function references from the slot
// entries. Reset slots explicitly here so each test starts with a
// clean registry and the previous test's component reference is
// gone for good.
beforeEach(() => {
  useTopBarStore.setState({ slots: {} });
});

describe("useTopBarStore", () => {
  it("starts with no slots registered", () => {
    expect(useTopBarStore.getState().slots).toEqual({});
  });

  it("setSlot registers a slot under the given id", () => {
    const { setSlot } = useTopBarStore.getState();
    setSlot("a", StubA, 50);
    const entry = useTopBarStore.getState().slots.a;
    expect(entry).toBeDefined();
    expect(entry.Component).toBe(StubA);
    expect(entry.order).toBe(50);
    expect(entry.id).toBe("a");
  });

  it("setSlot with the same id replaces the existing entry", () => {
    const { setSlot } = useTopBarStore.getState();
    setSlot("a", StubA, 10);
    setSlot("a", StubB, 10);
    const slots = useTopBarStore.getState().slots;
    expect(Object.keys(slots)).toEqual(["a"]);
    expect(slots.a.Component).toBe(StubB);
  });

  it("setSlot with Component: null removes the slot", () => {
    const { setSlot } = useTopBarStore.getState();
    setSlot("a", StubA, 0);
    setSlot("a", null);
    expect(useTopBarStore.getState().slots).toEqual({});
  });

  it("setSlot with Component: null on a missing id is a no-op", () => {
    const { setSlot } = useTopBarStore.getState();
    setSlot("never-added", null);
    expect(useTopBarStore.getState().slots).toEqual({});
  });

  it("removeSlot drops only the named id and leaves siblings alone", () => {
    const { setSlot, removeSlot } = useTopBarStore.getState();
    setSlot("a", StubA, 0);
    setSlot("b", StubB, 0);
    removeSlot("a");
    const slots = useTopBarStore.getState().slots;
    expect(Object.keys(slots)).toEqual(["b"]);
  });

  it("removeSlot on a missing id is a no-op", () => {
    const { setSlot, removeSlot } = useTopBarStore.getState();
    setSlot("a", StubA, 0);
    removeSlot("never-added");
    expect(Object.keys(useTopBarStore.getState().slots)).toEqual(["a"]);
  });

  it("setSlot defaults order to 0 when no order is passed", () => {
    const { setSlot } = useTopBarStore.getState();
    setSlot("a", StubA);
    expect(useTopBarStore.getState().slots.a.order).toBe(0);
  });
});

describe("selectSortedTopBarSlots", () => {
  it("orders entries by ascending order and preserves id", () => {
    const slots = {
      high: { id: "high", order: 200, Component: StubA },
      low: { id: "low", order: 0, Component: StubB },
      mid: { id: "mid", order: 100, Component: StubC },
    } as const;
    const sorted = selectSortedTopBarSlots(slots);
    expect(sorted.map((slot) => slot.id)).toEqual(["low", "mid", "high"]);
  });

  it("returns an empty array when no slots are registered", () => {
    expect(selectSortedTopBarSlots({})).toEqual([]);
  });
});
