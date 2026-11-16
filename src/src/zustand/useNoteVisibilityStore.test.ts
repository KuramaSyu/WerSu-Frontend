// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeApi = vi.hoisted(() => ({
  list: vi.fn(),
  hide: vi.fn(),
  unhide: vi.fn(),
}));

vi.mock("../api/NoteVisibilityApi", () => ({
  getNoteVisibilityApi: () => ({
    list: fakeApi.list,
    hide: fakeApi.hide,
    unhide: fakeApi.unhide,
  }),
}));

import { NoteVisibilityScope } from "../api/models/noteVisibility";
import {
  isNoteHiddenForScope,
  ruleHiddenForScope,
  useNoteVisibilityStore,
} from "./useNoteVisibilityStore";

const reset = () => {
  localStorage.clear();
  useNoteVisibilityStore.setState({
    notes: {},
    directories: {},
    loaded: false,
  });
  fakeApi.list.mockReset();
  fakeApi.hide.mockReset().mockResolvedValue(undefined);
  fakeApi.unhide.mockReset().mockResolvedValue(true);
};

describe("useNoteVisibilityStore", () => {
  beforeEach(() => {
    reset();
  });

  it("stores a note rule with the requested scope", () => {
    useNoteVisibilityStore
      .getState()
      .hideNote("n1", NoteVisibilityScope.RECENT_NOTES, { days: 7 });

    const rule = useNoteVisibilityStore.getState().notes.n1;
    expect(rule.scope).toBe(NoteVisibilityScope.RECENT_NOTES);
    expect(rule.expiresAt).toBeGreaterThan(Date.now());
    expect(fakeApi.hide).toHaveBeenCalledWith(
      { kind: "note", id: "n1" },
      NoteVisibilityScope.RECENT_NOTES,
      expect.objectContaining({ until: expect.any(Date) }),
    );
  });

  it("merges scopes without undoing an existing permanent rule", () => {
    const store = useNoteVisibilityStore.getState();
    store.hideNote("n1", NoteVisibilityScope.RECENT_NOTES, { days: 7 });
    useNoteVisibilityStore
      .getState()
      .hideNote("n1", NoteVisibilityScope.SEARCH);

    const rule = useNoteVisibilityStore.getState().notes.n1;
    expect(rule.scope).toBe(
      NoteVisibilityScope.RECENT_NOTES | NoteVisibilityScope.SEARCH,
    );
    expect(rule.expiresAt).toBeUndefined();
  });

  it("unhides one scope while keeping the others", () => {
    useNoteVisibilityStore
      .getState()
      .hideNote(
        "n1",
        NoteVisibilityScope.RECENT_NOTES | NoteVisibilityScope.SEARCH,
      );
    useNoteVisibilityStore
      .getState()
      .unhideNote("n1", NoteVisibilityScope.RECENT_NOTES);

    const rule = useNoteVisibilityStore.getState().notes.n1;
    expect(rule.scope).toBe(NoteVisibilityScope.SEARCH);
    expect(fakeApi.unhide).toHaveBeenCalledWith({
      note_id: "n1",
      scope: NoteVisibilityScope.RECENT_NOTES,
    });
  });

  it("drops an entire rule when unhide has no scope", () => {
    useNoteVisibilityStore
      .getState()
      .hideNote("n1", NoteVisibilityScope.SEARCH);
    useNoteVisibilityStore.getState().unhideNote("n1");
    expect(useNoteVisibilityStore.getState().notes.n1).toBeUndefined();
  });

  it("treats expired rules as visible again", () => {
    useNoteVisibilityStore.setState({
      notes: {
        old: { scope: NoteVisibilityScope.SEARCH, hiddenAt: 0, expiresAt: 1 },
      },
    });

    expect(
      ruleHiddenForScope(
        useNoteVisibilityStore.getState().notes,
        "old",
        NoteVisibilityScope.SEARCH,
      ),
    ).toBe(false);
  });

  it("hides notes through a hidden parent directory", () => {
    useNoteVisibilityStore
      .getState()
      .hideDirectory("d1", NoteVisibilityScope.FREQUENT_NOTES);

    const state = useNoteVisibilityStore.getState();
    expect(
      isNoteHiddenForScope(
        state.notes,
        state.directories,
        "n1",
        NoteVisibilityScope.FREQUENT_NOTES,
        ["d1"],
      ),
    ).toBe(true);
    expect(
      isNoteHiddenForScope(
        state.notes,
        state.directories,
        "n1",
        NoteVisibilityScope.SEARCH,
        ["d1"],
      ),
    ).toBe(false);
  });

  it("replaces the local rules from the backend list", async () => {
    fakeApi.list.mockResolvedValue([
      {
        kind: "note",
        id: "server-note",
        scope: NoteVisibilityScope.SEARCH,
        hidden_at: "2026-01-01T00:00:00Z",
      },
    ]);

    await useNoteVisibilityStore.getState().refresh();

    const state = useNoteVisibilityStore.getState();
    expect(state.loaded).toBe(true);
    expect(Object.keys(state.notes)).toEqual(["server-note"]);
    expect(fakeApi.list).toHaveBeenCalledTimes(1);
  });

  it("keeps local rules when the backend list fails", async () => {
    useNoteVisibilityStore
      .getState()
      .hideNote("local-note", NoteVisibilityScope.SEARCH);
    fakeApi.list.mockRejectedValue(new Error("404"));

    await useNoteVisibilityStore.getState().refresh();

    const state = useNoteVisibilityStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.notes["local-note"]).toBeDefined();
  });

  it("clears every rule and mirrors the clear to the API", () => {
    useNoteVisibilityStore
      .getState()
      .hideNote("n1", NoteVisibilityScope.SEARCH);
    useNoteVisibilityStore
      .getState()
      .hideDirectory("d1", NoteVisibilityScope.RECENT_NOTES);

    useNoteVisibilityStore.getState().clear();

    const state = useNoteVisibilityStore.getState();
    expect(state.notes).toEqual({});
    expect(state.directories).toEqual({});
    expect(fakeApi.unhide).toHaveBeenCalledWith({ all: true });
  });
});