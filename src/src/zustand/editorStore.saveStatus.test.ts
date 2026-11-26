
// Tier-1 tests for the active note's save-status lifecycle.
//
// The Save control in the top bar reports these states inline, so the
// store must expose `saving` while the request is in flight, `saved`
// on success, and `failed` on error (where the snackbar stays the only
// error surface). Success deliberately emits no snackbar anymore.
//
// The state machine guarantees a minimum "Saving" display window and
// owns the 4 s "Saved now" timeout, so these tests drive fake timers.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useActiveNoteStore } from "./editorStore";
import useInfoStore, { SnackbarUpdateImpl } from "./InfoStore";
import { useDraftStore } from "./useDraftStore";
import {
  MIN_SAVING_DISPLAY_MS,
  SAVED_STATUS_DURATION_MS,
} from "./noteSaveMachine";

beforeEach(() => {
  vi.useFakeTimers();
  useDraftStore.getState().clearAll();
  useInfoStore.setState({ Message: new SnackbarUpdateImpl(""), logs: [] });
  // registerNote resets the machine owned by the store, clearing any
  // timer left over from a previous test.
  useActiveNoteStore.getState().registerNote("note-1", () => {});
  useActiveNoteStore.setState({
    noteId: "note-1",
    editor: null,
    ydoc: null,
    title: "Title",
    sourceMarkdown: "Body",
    headerImageMarkdown: null,
    isSaving: false,
    onNoteUpdated: null,
  });
  // The draft store is the dirty flag: a changed note is savable.
  useDraftStore.getState().markDraft("note-1", { changedChars: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useActiveNoteStore.save status", () => {
  it("keeps saving for the minimum window, then reports saved", async () => {
    let resolveUpdate: (note: never) => void = () => {};
    const updateNote = vi.fn(
      () =>
        new Promise<never>((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    useActiveNoteStore.setState({ updateNote });

    const pending = useActiveNoteStore.getState().save();
    expect(useActiveNoteStore.getState().saveStatus).toBe("saving");
    expect(useActiveNoteStore.getState().isSaving).toBe(true);

    resolveUpdate({} as never);
    await vi.advanceTimersByTimeAsync(MIN_SAVING_DISPLAY_MS - 1);
    expect(useActiveNoteStore.getState().saveStatus).toBe("saving");

    await vi.advanceTimersByTimeAsync(1);
    await pending;

    expect(useActiveNoteStore.getState().saveStatus).toBe("saved");
    expect(useActiveNoteStore.getState().isSaving).toBe(false);
    expect(useInfoStore.getState().Message.message).toBe("");

    // "Saved now" is a 10-second state; the machine then returns to
    // the no-changes state.
    await vi.advanceTimersByTimeAsync(SAVED_STATUS_DURATION_MS);
    expect(useActiveNoteStore.getState().saveStatus).toBe("notSavable");
  });

  it("queues another save when a second tick arrives while saving", async () => {
    let resolveFirst: (note: never) => void = () => {};
    const updateNote = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<never>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue({} as never);
    useActiveNoteStore.setState({ updateNote });

    const pending = useActiveNoteStore.getState().save();
    // Second tick while the first request is in flight: request a
    // follow-up instead of dropping it.
    await useActiveNoteStore.getState().save();
    expect(updateNote).toHaveBeenCalledTimes(1);

    resolveFirst({} as never);
    await vi.advanceTimersByTimeAsync(MIN_SAVING_DISPLAY_MS);

    // The first save reached SavedState, then the queued save moved
    // success -> saving again with the latest document.
    expect(updateNote).toHaveBeenCalledTimes(2);
    expect(useActiveNoteStore.getState().saveStatus).toBe("saving");

    await vi.advanceTimersByTimeAsync(MIN_SAVING_DISPLAY_MS);
    await pending;
    expect(useActiveNoteStore.getState().saveStatus).toBe("saved");
  });

  it("does not start a save when there are no changes", async () => {
    useDraftStore.getState().clearDraft("note-1");
    expect(useActiveNoteStore.getState().saveStatus).toBe("notSavable");

    const updateNote = vi.fn();
    useActiveNoteStore.setState({ updateNote });

    await useActiveNoteStore.getState().save();

    expect(updateNote).not.toHaveBeenCalled();
    expect(useActiveNoteStore.getState().saveStatus).toBe("notSavable");
    expect(useActiveNoteStore.getState().isSaving).toBe(false);
  });

  it("keeps saving for the minimum window before reporting failure", async () => {
    useActiveNoteStore.setState({
      updateNote: vi.fn().mockRejectedValue(new Error("network down")),
    });

    const pending = useActiveNoteStore.getState().save();
    await vi.advanceTimersByTimeAsync(0);
    expect(useActiveNoteStore.getState().saveStatus).toBe("saving");

    await vi.advanceTimersByTimeAsync(MIN_SAVING_DISPLAY_MS - 1);
    expect(useActiveNoteStore.getState().saveStatus).toBe("saving");

    await vi.advanceTimersByTimeAsync(1);
    await pending;

    expect(useActiveNoteStore.getState().saveStatus).toBe("failed");
    expect(useActiveNoteStore.getState().isSaving).toBe(false);
    expect(useInfoStore.getState().Message.message).toBe(
      "Failed to save note",
    );
    expect(useInfoStore.getState().Message.severity).toBe("error");
  });
});
