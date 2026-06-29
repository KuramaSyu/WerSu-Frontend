// Tier 1 unit test for `useViewConfig`.
//
// Behaviour we care about:
//   - default config has `readOnly: false` so private-note UX stays
//     untouched.
//   - `setViewConfig({ readOnly: true })` flips the flag (this is what
//     `PublicNotePage` does on mount).
//   - `resetViewConfig()` clears the flag (the cleanup path used on
//     unmount). This is the easy-to-forget piece — without it,
//     navigating from a read-only public share to `/n/<owned-id>`
//     would leave the editor read-only.
//
// We don't render any MUI here, so the test stays well clear of the
// `material-color-utilities` ESM-graph landmine documented in
// `setup.ts`.

// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it } from "vitest";

import { useViewConfig } from "./useViewConfig";

beforeEach(() => {
  // The zustand-reset hook in `setup.ts` restores the snapshot taken
  // at module load, so each test starts at `DEFAULT_VIEW_CONFIG`.
});

describe("useViewConfig", () => {
  it("defaults to readOnly: false", () => {
    expect(useViewConfig.getState().config.readOnly).toBe(false);
  });

  it("setViewConfig flips readOnly to true", () => {
    useViewConfig.getState().setViewConfig({ readOnly: true });
    expect(useViewConfig.getState().config.readOnly).toBe(true);
  });

  it("resetViewConfig clears any flags back to the default", () => {
    useViewConfig.getState().setViewConfig({ readOnly: true });
    useViewConfig.getState().resetViewConfig();
    expect(useViewConfig.getState().config.readOnly).toBe(false);
  });
});
