// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it } from "vitest";
import { useDirectorySelectionStore } from "./useDirectorySelectionStore";

const reset = () =>
  useDirectorySelectionStore.setState({ selected: {}, active: false });

describe("useDirectorySelectionStore", () => {
  beforeEach(() => {
    reset();
  });

  it("starts empty and inactive", () => {
    const state = useDirectorySelectionStore.getState();
    expect(state.selected).toEqual({});
    expect(state.active).toBe(false);
  });

  it("startSelection activates mode and stores the entry", () => {
    useDirectorySelectionStore.getState().startSelection({
      kind: "note",
      id: "n1",
    });
    const state = useDirectorySelectionStore.getState();
    expect(state.active).toBe(true);
    expect(state.selected["note:n1"]).toEqual({ kind: "note", id: "n1" });
  });

  it("toggle adds a new entry and flips active on first add", () => {
    useDirectorySelectionStore.getState().toggle({ kind: "note", id: "n1" });
    const state = useDirectorySelectionStore.getState();
    expect(state.active).toBe(true);
    expect(state.selected["note:n1"]).toBeDefined();
  });

  it("toggle removes an existing entry without clearing active", () => {
    useDirectorySelectionStore.getState().startSelection({
      kind: "note",
      id: "n1",
    });
    useDirectorySelectionStore.getState().toggle({ kind: "note", id: "n1" });
    const state = useDirectorySelectionStore.getState();
    expect(state.selected["note:n1"]).toBeUndefined();
    // active stays true so the user keeps the multi-select UI up
    // even after deselecting the only item.
    expect(state.active).toBe(true);
  });

  it("keys directories and notes separately", () => {
    useDirectorySelectionStore.getState().setMany([
      { kind: "note", id: "abc" },
      { kind: "directory", id: "abc" },
    ]);
    const state = useDirectorySelectionStore.getState();
    expect(state.selected["note:abc"]).toBeDefined();
    expect(state.selected["directory:abc"]).toBeDefined();
    expect(Object.keys(state.selected)).toHaveLength(2);
  });

  it("selectAll replaces the selection and activates mode", () => {
    useDirectorySelectionStore.getState().selectAll([
      { kind: "note", id: "n1" },
      { kind: "note", id: "n2" },
    ]);
    const state = useDirectorySelectionStore.getState();
    expect(state.active).toBe(true);
    expect(Object.keys(state.selected)).toHaveLength(2);
  });

  it("clear drops the selection and deactivates mode", () => {
    useDirectorySelectionStore.getState().startSelection({
      kind: "note",
      id: "n1",
    });
    useDirectorySelectionStore.getState().clear();
    const state = useDirectorySelectionStore.getState();
    expect(state.selected).toEqual({});
    expect(state.active).toBe(false);
  });

  it("exitSelectMode clears the active flag but keeps the selection", () => {
    useDirectorySelectionStore.getState().startSelection({
      kind: "note",
      id: "n1",
    });
    useDirectorySelectionStore.getState().exitSelectMode();
    const state = useDirectorySelectionStore.getState();
    expect(state.active).toBe(false);
    expect(state.selected["note:n1"]).toBeDefined();
  });
});
