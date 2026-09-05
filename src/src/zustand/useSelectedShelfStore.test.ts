// Tier-1 unit test for `useSelectedShelfStore`.
//
// Behaviour we care about:
//   - default state has `selectedShelfId === null`;
//   - `setSelectedShelfId(id)` writes the id;
//   - `setSelectedShelfId(null)` clears the pick;
//   - the pick survives a page reload (persisted to localStorage);
//   - repeated calls overwrite (no append).

// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSelectedShelfStore } from "./useSelectedShelfStore";

const STORAGE_KEY = "selected-shelf-storage";

beforeEach(() => {
  localStorage.clear();
  useSelectedShelfStore.setState({ selectedShelfId: null });
});

describe("useSelectedShelfStore", () => {
  it("starts with no shelf selected", () => {
    expect(useSelectedShelfStore.getState().selectedShelfId).toBeNull();
  });

  it("setSelectedShelfId writes the picked id", () => {
    const { setSelectedShelfId } = useSelectedShelfStore.getState();
    setSelectedShelfId("shelf-1");
    expect(useSelectedShelfStore.getState().selectedShelfId).toBe("shelf-1");
  });

  it("setSelectedShelfId(null) clears the pick", () => {
    const { setSelectedShelfId } = useSelectedShelfStore.getState();
    setSelectedShelfId("shelf-1");
    setSelectedShelfId(null);
    expect(useSelectedShelfStore.getState().selectedShelfId).toBeNull();
  });

  it("setSelectedShelfId overwrites an existing pick", () => {
    const { setSelectedShelfId } = useSelectedShelfStore.getState();
    setSelectedShelfId("shelf-1");
    setSelectedShelfId("shelf-2");
    expect(useSelectedShelfStore.getState().selectedShelfId).toBe("shelf-2");
  });

  it("persists the pick to localStorage", () => {
    useSelectedShelfStore.getState().setSelectedShelfId("shelf-research");
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "{}")).toMatchObject({
      state: { selectedShelfId: "shelf-research" },
    });
  });

  it("hydrates the pick on the next page load", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { selectedShelfId: "shelf-personal" },
        version: 1,
      }),
    );
    // Clear the module cache so the next import re-runs the
    // `persist` middleware's hydration against the freshly-seeded
    // localStorage entry. The store singleton is recreated.
    vi.resetModules();
    const fresh = await import("./useSelectedShelfStore");
    expect(fresh.useSelectedShelfStore.getState().selectedShelfId).toBe(
      "shelf-personal",
    );
  });
});
