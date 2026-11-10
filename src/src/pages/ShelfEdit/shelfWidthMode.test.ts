// Tier-1 tests for the shelf width preset table.
//
// Pure data + the cycle helper, so no MUI or DOM is involved.

import { describe, expect, it } from "vitest";

import {
  SHELF_WIDTH_MODES,
  SHELF_WIDTH_STATES,
  nextShelfWidthMode,
} from "./shelfWidthMode";

describe("shelfWidthMode", () => {
  it("cycles normal -> wide -> full -> normal", () => {
    expect(nextShelfWidthMode("normal")).toBe("wide");
    expect(nextShelfWidthMode("wide")).toBe("full");
    expect(nextShelfWidthMode("full")).toBe("normal");
  });

  it("falls back to normal for an unknown value", () => {
    expect(nextShelfWidthMode("nonsense" as never)).toBe("normal");
  });

  it("defines a fluid width for every mode and never a bare pixel value", () => {
    for (const mode of SHELF_WIDTH_MODES) {
      const state = SHELF_WIDTH_STATES[mode];
      expect(state).toBeDefined();
      expect(state.id).toBe(mode);
      expect(state.contentWidth.length).toBeGreaterThan(0);
      // Fixed px is disallowed here; normal/wide must use clamp.
      if (mode !== "full") {
        expect(state.contentWidth).toContain("clamp(");
      }
    }
  });
});
