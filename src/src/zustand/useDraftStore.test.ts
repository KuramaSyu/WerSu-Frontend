// Tier-1 unit tests for the local draft tracker.

// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  formatDraftChangeLabel,
  formatDraftSizeChip,
  getDraftUrgency,
  getDraftUrgencyScore,
  useDraftStore,
} from "./useDraftStore";
import { useDraftNoteIds } from "../api/queries/useDraftQueries";

beforeEach(() => {
  useDraftStore.setState({ drafts: {} });
});

describe("useDraftStore", () => {
  it("marks a draft and stamps updatedAt / firstEditAt", () => {
    useDraftStore.getState().markDraft("n-1", { updatedAt: 1000 });
    expect(useDraftStore.getState().drafts["n-1"]).toEqual({
      noteId: "n-1",
      updatedAt: 1000,
      firstEditAt: 1000,
      changedChars: 0,
    });
  });

  it("accumulates changedChars and keeps firstEditAt on re-mark", () => {
    useDraftStore.getState().markDraft("n-1", {
      updatedAt: 1000,
      changedChars: 10,
    });
    useDraftStore.getState().markDraft("n-1", {
      updatedAt: 2000,
      changedChars: 5,
    });
    const entry = useDraftStore.getState().drafts["n-1"];
    expect(entry.updatedAt).toBe(2000);
    expect(entry.firstEditAt).toBe(1000);
    expect(entry.changedChars).toBe(15);
  });

  it("clamps negative change deltas to zero", () => {
    useDraftStore.getState().markDraft("n-1", { changedChars: -50 });
    expect(useDraftStore.getState().drafts["n-1"].changedChars).toBe(0);
  });

  it("clears a draft and leaves others untouched", () => {
    useDraftStore.getState().markDraft("n-1", { updatedAt: 1000 });
    useDraftStore.getState().markDraft("n-2", { updatedAt: 2000 });
    useDraftStore.getState().clearDraft("n-1");
    expect(useDraftStore.getState().drafts["n-1"]).toBeUndefined();
    expect(useDraftStore.getState().drafts["n-2"]).toBeDefined();
  });

  it("bulk-replaces drafts via setDrafts", () => {
    useDraftStore.getState().markDraft("stale", { updatedAt: 1 });
    useDraftStore.getState().setDrafts([
      { noteId: "n-1", updatedAt: 1000, firstEditAt: 1000, changedChars: 1 },
      { noteId: "n-2", updatedAt: 2000, firstEditAt: 2000, changedChars: 2 },
    ]);
    expect(Object.keys(useDraftStore.getState().drafts).sort()).toEqual([
      "n-1",
      "n-2",
    ]);
  });
});

describe("draft urgency", () => {
  const entry = (changedChars: number, firstEditAt: number) => ({
    noteId: "n-1",
    updatedAt: firstEditAt,
    firstEditAt,
    changedChars,
  });

  it("scores change volume above age", () => {
    const now = 60_000; // 1 minute after firstEditAt
    const small = entry(100, 0);
    const large = entry(1000, 0);
    expect(getDraftUrgencyScore(large, now)).toBeGreaterThan(
      getDraftUrgencyScore(small, now),
    );
  });

  it("escalates the score as a draft ages", () => {
    const draft = entry(500, 0);
    expect(getDraftUrgencyScore(draft, 60_000)).toBeGreaterThan(
      getDraftUrgencyScore(draft, 0),
    );
  });

  it("buckets scores into urgency tiers", () => {
    const now = 0;
    expect(getDraftUrgency(entry(0, 0), now)).toBe("low");
    expect(getDraftUrgency(entry(2000, 0), now)).toBe("medium");
    expect(getDraftUrgency(entry(10_000, 0), now)).toBe("high");
  });

  it("formats the change magnitude label", () => {
    expect(formatDraftChangeLabel(1)).toBe("~1 char changed");
    expect(formatDraftChangeLabel(42)).toBe("~42 chars changed");
    expect(formatDraftChangeLabel(1500)).toBe("~1.5k chars changed");
  });

  it("formats the compact chip label", () => {
    expect(formatDraftSizeChip(42)).toBe("~42");
    expect(formatDraftSizeChip(1500)).toBe("~1.5k");
  });
});

describe("useDraftNoteIds", () => {
  it("orders drafts most-urgent-first", () => {
    useDraftStore.setState({
      drafts: {
        small: {
          noteId: "small",
          updatedAt: 0,
          firstEditAt: 0,
          changedChars: 10,
        },
        big: {
          noteId: "big",
          updatedAt: 0,
          firstEditAt: 0,
          changedChars: 10_000,
        },
      },
    });
    const { result } = renderHook(() => useDraftNoteIds());
    expect(result.current).toEqual(["big", "small"]);
  });

  it("reacts to a draft being cleared", () => {
    useDraftStore.getState().markDraft("n-1", { updatedAt: 1000 });
    const { result } = renderHook(() => useDraftNoteIds());
    expect(result.current).toEqual(["n-1"]);
    act(() => {
      useDraftStore.getState().clearDraft("n-1");
    });
    expect(result.current).toEqual([]);
  });
});
