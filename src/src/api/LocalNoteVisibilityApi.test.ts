// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it } from "vitest";
import { LocalNoteVisibilityApi } from "./LocalNoteVisibilityApi";
import { NoteVisibilityScope } from "./models/noteVisibility";
import { useNoteVisibilityStore } from "../zustand/useNoteVisibilityStore";

const reset = () => {
  localStorage.clear();
  useNoteVisibilityStore.setState({
    notes: {},
    directories: {},
    loaded: false,
  });
};

describe("LocalNoteVisibilityApi", () => {
  beforeEach(() => {
    reset();
  });

  it("starts empty", async () => {
    const api = new LocalNoteVisibilityApi();
    await expect(api.list()).resolves.toEqual([]);
  });

  it("hides a note through the zustand store and lists it", async () => {
    const api = new LocalNoteVisibilityApi();
    const entry = await api.hideNote("n1", NoteVisibilityScope.RECENT_NOTES, {
      days: 7,
    });

    expect(entry.kind).toBe("note");
    expect(entry.id).toBe("n1");
    expect(entry.scope).toBe(NoteVisibilityScope.RECENT_NOTES);
    expect(entry.expires_at).toBeDefined();

    const state = useNoteVisibilityStore.getState();
    expect(state.notes.n1?.scope).toBe(NoteVisibilityScope.RECENT_NOTES);
    await expect(api.list()).resolves.toHaveLength(1);
  });

  it("persists the rule into localStorage", async () => {
    const api = new LocalNoteVisibilityApi();
    await api.hideNote("n1", NoteVisibilityScope.SEARCH);

    const raw = localStorage.getItem("note-visibility-storage");
    expect(raw).toBeTruthy();
    expect(raw).toContain("n1");
  });

  it("hides a directory and merges scopes", async () => {
    const api = new LocalNoteVisibilityApi();
    await api.hideDirectory("d1", NoteVisibilityScope.FREQUENT_NOTES);
    const entry = await api.hideDirectory(
      "d1",
      NoteVisibilityScope.SEARCH,
    );

    expect(entry.scope).toBe(
      NoteVisibilityScope.FREQUENT_NOTES | NoteVisibilityScope.SEARCH,
    );
    expect(useNoteVisibilityStore.getState().directories.d1).toBeDefined();
  });

  it("unhides only the requested scope", async () => {
    const api = new LocalNoteVisibilityApi();
    await api.hideNote(
      "n1",
      NoteVisibilityScope.RECENT_NOTES | NoteVisibilityScope.SEARCH,
    );

    await expect(
      api.unhide({ note_id: "n1", scope: NoteVisibilityScope.RECENT_NOTES }),
    ).resolves.toBe(true);

    expect(useNoteVisibilityStore.getState().notes.n1?.scope).toBe(
      NoteVisibilityScope.SEARCH,
    );
  });

  it("clears everything when no target is given", async () => {
    const api = new LocalNoteVisibilityApi();
    await api.hideNote("n1", NoteVisibilityScope.SEARCH);
    await api.hideDirectory("d1", NoteVisibilityScope.SEARCH);

    await expect(api.unhide()).resolves.toBe(true);

    const state = useNoteVisibilityStore.getState();
    expect(state.notes).toEqual({});
    expect(state.directories).toEqual({});
    await expect(api.list()).resolves.toEqual([]);
  });

  it("does not list expired rules", async () => {
    useNoteVisibilityStore.setState({
      notes: {
        old: { scope: NoteVisibilityScope.SEARCH, hiddenAt: 0, expiresAt: 1 },
      },
    });

    const api = new LocalNoteVisibilityApi();
    await expect(api.list()).resolves.toEqual([]);
  });
});