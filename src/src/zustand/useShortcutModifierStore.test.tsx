// Tier-1 unit test for the shared Ctrl/Cmd modifier flag.
//
// Behaviour we care about:
//   - defaults to false so ShortcutTooltip doesn't snap open
//     when no modifier is held
//   - `setModifierPressed(true)` flips the flag on
//   - `setModifierPressed(false)` flips it back off
//
// Pure-helper test -- no React tree, no MUI. Stays clear of the
// `@mui/material/styles` ESM-graph landmine documented in
// `setup.ts`.

// @vitest-environment jsdom

import "../test/setup";

import { describe, expect, it } from "vitest";

import { useShortcutModifierStore } from "./useShortcutModifierStore";

describe("useShortcutModifierStore", () => {
  it("defaults isModifierPressed to false", () => {
    expect(useShortcutModifierStore.getState().isModifierPressed).toBe(false);
  });

  it("setModifierPressed(true) flips the flag on", () => {
    useShortcutModifierStore.getState().setModifierPressed(true);
    expect(useShortcutModifierStore.getState().isModifierPressed).toBe(true);
  });

  it("setModifierPressed(false) clears the flag", () => {
    const { setModifierPressed } = useShortcutModifierStore.getState();
    setModifierPressed(true);
    setModifierPressed(false);
    expect(useShortcutModifierStore.getState().isModifierPressed).toBe(false);
  });
});
