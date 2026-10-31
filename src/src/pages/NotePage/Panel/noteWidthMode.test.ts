// Tier-1 unit tests for the editor width state table and helpers.
//
// The contract:
//   - there are exactly three states in the cycle: normal, wide, full;
//   - `full` is the only state that manages panels, and it collapses
//     both so it is genuinely the widest state;
//   - `normal`/`wide` leave the panels alone;
//   - `nextNoteWidthMode` advances and wraps, and tolerates a stale
//     unknown value by falling back to `normal`;
//   - `getNoteEditorWidths` resolves each state's widths and forces 100%
//     on mobile.

import { describe, expect, it } from "vitest";

import {
  NOTE_WIDTH_MODES,
  NOTE_WIDTH_STATES,
  getNoteEditorWidths,
  nextNoteWidthMode,
} from "./noteWidthMode";

describe("NOTE_WIDTH_STATES", () => {
  it("exposes exactly normal, wide and full in order", () => {
    expect(NOTE_WIDTH_MODES).toEqual(["normal", "wide", "full"]);
  });

  it("gives every state a label, tooltip and widths", () => {
    for (const mode of NOTE_WIDTH_MODES) {
      const state = NOTE_WIDTH_STATES[mode];
      expect(state.id).toBe(mode);
      expect(state.label).toBeTruthy();
      expect(state.tooltip).toBe(`Current: ${state.label}`);
      expect(state.bodyWidth).toBeTruthy();
      expect(state.paperWidth).toBeTruthy();
    }
  });

  it("only full manages the panels, and collapses both", () => {
    expect(NOTE_WIDTH_STATES.normal.panels).toBeNull();
    expect(NOTE_WIDTH_STATES.wide.panels).toBeNull();
    expect(NOTE_WIDTH_STATES.full.panels).toEqual({
      leftOpen: false,
      rightOpen: false,
    });
  });

  it("makes full the widest state", () => {
    expect(NOTE_WIDTH_STATES.full.bodyWidth).toBe("100%");
    expect(NOTE_WIDTH_STATES.full.paperWidth).toBe("100%");
  });
});

describe("nextNoteWidthMode", () => {
  it("cycles normal -> wide -> full -> normal", () => {
    expect(nextNoteWidthMode("normal")).toBe("wide");
    expect(nextNoteWidthMode("wide")).toBe("full");
    expect(nextNoteWidthMode("full")).toBe("normal");
  });

  it("falls back to normal for an unknown mode", () => {
    // Cast through never: this simulates a stale value.
    expect(nextNoteWidthMode("bogus" as never)).toBe("normal");
  });
});

describe("getNoteEditorWidths", () => {
  it("forces 100% on mobile regardless of preset", () => {
    for (const mode of NOTE_WIDTH_MODES) {
      expect(getNoteEditorWidths(mode, true)).toEqual({
        body: "100%",
        paper: "100%",
      });
    }
  });

  it("resolves each state's own widths on desktop", () => {
    for (const mode of NOTE_WIDTH_MODES) {
      expect(getNoteEditorWidths(mode, false)).toEqual({
        body: NOTE_WIDTH_STATES[mode].bodyWidth,
        paper: NOTE_WIDTH_STATES[mode].paperWidth,
      });
    }
  });

  it("falls back to normal for an unknown mode", () => {
    expect(getNoteEditorWidths("bogus" as never, false)).toEqual({
      body: NOTE_WIDTH_STATES.normal.bodyWidth,
      paper: NOTE_WIDTH_STATES.normal.paperWidth,
    });
  });
});
