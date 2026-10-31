// Tier 1 tests for the conflict-detection helpers in
// `collabReconcile.ts`. Pure functions, no React, no Hocuspocus.

import { describe, expect, it } from "vitest";
import {
  buildLineDiff,
  computeReconnectDiff,
  shouldPromptMergeOnReconnect,
} from "./collabReconcile";

describe("computeReconnectDiff", () => {
  it("returns clean when only the local side changed", () => {
    const diff = computeReconnectDiff({
      localMarkdown: "fresh local edit",
      preOfflineCloud: "old",
      currentCloud: "old",
      hasUnsyncedLocalEdits: true,
      lastLocalEditAt: 100,
    });
    expect(diff.verdict).toBe("clean");
    expect(diff.localMarkdown).toBe("fresh local edit");
  });

  it("returns clean when only the server side changed", () => {
    const diff = computeReconnectDiff({
      localMarkdown: "old",
      preOfflineCloud: "old",
      currentCloud: "fresh server edit",
      hasUnsyncedLocalEdits: false,
      lastLocalEditAt: null,
    });
    expect(diff.verdict).toBe("clean");
  });

  it("returns conflict when both sides changed", () => {
    const diff = computeReconnectDiff({
      localMarkdown: "local edit",
      preOfflineCloud: "old",
      currentCloud: "server edit",
      hasUnsyncedLocalEdits: true,
      lastLocalEditAt: 100,
    });
    expect(diff.verdict).toBe("conflict");
  });

  it("returns clean when neither side changed", () => {
    const diff = computeReconnectDiff({
      localMarkdown: "same",
      preOfflineCloud: "same",
      currentCloud: "same",
      hasUnsyncedLocalEdits: false,
      lastLocalEditAt: null,
    });
    expect(diff.verdict).toBe("clean");
  });

  it("propagates lastLocalEditAt for the modal's chip", () => {
    const diff = computeReconnectDiff({
      localMarkdown: "x",
      preOfflineCloud: "x",
      currentCloud: "x",
      hasUnsyncedLocalEdits: true,
      lastLocalEditAt: 1234,
    });
    expect(diff.lastLocalEditAt).toBe(1234);
  });
});

describe("shouldPromptMergeOnReconnect", () => {
  it("prompts when the local buffer diverged from the pre-offline snapshot", () => {
    expect(
      shouldPromptMergeOnReconnect({
        localMarkdown: "local edit",
        preOfflineCloud: "old",
        hasUnsyncedLocalEdits: true,
      }),
    ).toBe(true);
  });

  it("does not prompt when there are no unsynced local edits", () => {
    expect(
      shouldPromptMergeOnReconnect({
        localMarkdown: "local edit",
        preOfflineCloud: "old",
        hasUnsyncedLocalEdits: false,
      }),
    ).toBe(false);
  });

  it("does not prompt when the local buffer equals the baseline", () => {
    expect(
      shouldPromptMergeOnReconnect({
        localMarkdown: "same",
        preOfflineCloud: "same",
        hasUnsyncedLocalEdits: true,
      }),
    ).toBe(false);
  });

  it("prompts on the auto-fallback path without a baseline", () => {
    expect(
      shouldPromptMergeOnReconnect({
        localMarkdown: "local edit",
        preOfflineCloud: null,
        hasUnsyncedLocalEdits: true,
      }),
    ).toBe(true);
  });
});

describe("buildLineDiff", () => {
  it("returns unchanged lines for identical input", () => {
    const diff = buildLineDiff("a\nb", "a\nb");
    expect(diff).toEqual([
      { kind: "unchanged", text: "a" },
      { kind: "unchanged", text: "b" },
    ]);
  });

  it("marks added lines in the right column", () => {
    const diff = buildLineDiff("a", "a\nb");
    expect(diff).toEqual([
      { kind: "unchanged", text: "a" },
      { kind: "added", text: "b" },
    ]);
  });

  it("marks removed lines in the left column", () => {
    const diff = buildLineDiff("a\nb", "a");
    expect(diff).toEqual([
      { kind: "unchanged", text: "a" },
      { kind: "removed", text: "b" },
    ]);
  });
});
