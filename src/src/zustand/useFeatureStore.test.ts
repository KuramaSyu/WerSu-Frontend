// Tier-1 unit test for `useFeatureStore`.
//
// Behaviour we care about:
//   - `DeveloperMode` defaults to `false` so production users
//     never see debug surfaces out of the box.
//   - `setFlag(name, value)` flips the named flag, leaving the
//     others untouched (this is what the settings Switch wires to).
//   - `resetFlags()` puts every flag back to its default; an old
//     persisted shape with unknown / wrong-typed keys must not
//     crash the store.
//
// Pure-helper test — no React tree, no MUI. Stays clear of the
// `@mui/material/styles` ESM-graph landmine documented in
// `setup.ts`.

// @vitest-environment jsdom

import "../test/setup";

import { describe, expect, it } from "vitest";

import { FeatureFlagName, useFeatureStore } from "./FeatureStore";

describe("useFeatureStore", () => {
  it("defaults DeveloperMode to false", () => {
    expect(
      useFeatureStore.getState().flags[FeatureFlagName.DeveloperMode],
    ).toBe(false);
  });

  it("setFlag flips only the named flag", () => {
    useFeatureStore.getState().setFlag(FeatureFlagName.DeveloperMode, true);
    expect(
      useFeatureStore.getState().flags[FeatureFlagName.DeveloperMode],
    ).toBe(true);
  });

  it("setFlag back to false disables the flag", () => {
    const { setFlag } = useFeatureStore.getState();
    setFlag(FeatureFlagName.DeveloperMode, true);
    setFlag(FeatureFlagName.DeveloperMode, false);
    expect(
      useFeatureStore.getState().flags[FeatureFlagName.DeveloperMode],
    ).toBe(false);
  });

  it("resetFlags clears every flag back to defaults", () => {
    const { setFlag, resetFlags } = useFeatureStore.getState();
    setFlag(FeatureFlagName.DeveloperMode, true);
    setFlag(FeatureFlagName.BlurredBackgroundDebug, true);
    resetFlags();
    expect(
      useFeatureStore.getState().flags[FeatureFlagName.DeveloperMode],
    ).toBe(false);
    expect(
      useFeatureStore.getState().flags[FeatureFlagName.BlurredBackgroundDebug],
    ).toBe(false);
  });

  it("BlurredBackgroundDebug defaults to false", () => {
    useFeatureStore.getState().resetFlags();
    expect(
      useFeatureStore.getState().flags[FeatureFlagName.BlurredBackgroundDebug],
    ).toBe(false);
  });

  it("FlatLayout defaults to true", () => {
    useFeatureStore.getState().resetFlags();
    expect(useFeatureStore.getState().flags[FeatureFlagName.FlatLayout]).toBe(
      true,
    );
  });

  it("performance mode and its sub-flags default to off", () => {
    useFeatureStore.getState().resetFlags();
    const flags = useFeatureStore.getState().flags;
    expect(flags[FeatureFlagName.PerformanceMode]).toBe(false);
    expect(flags[FeatureFlagName.ReduceMotion]).toBe(false);
    expect(flags[FeatureFlagName.DisableBlur]).toBe(false);
    expect(flags[FeatureFlagName.IgnoreBackgroundImage]).toBe(false);
  });

  it("setPerformanceMode toggles the preset as a group", () => {
    const { setPerformanceMode } = useFeatureStore.getState();
    setPerformanceMode(true);
    let flags = useFeatureStore.getState().flags;
    expect(flags[FeatureFlagName.PerformanceMode]).toBe(true);
    expect(flags[FeatureFlagName.ReduceMotion]).toBe(true);
    expect(flags[FeatureFlagName.DisableBlur]).toBe(true);
    expect(flags[FeatureFlagName.IgnoreBackgroundImage]).toBe(true);

    setPerformanceMode(false);
    flags = useFeatureStore.getState().flags;
    expect(flags[FeatureFlagName.PerformanceMode]).toBe(false);
    expect(flags[FeatureFlagName.ReduceMotion]).toBe(false);
    expect(flags[FeatureFlagName.DisableBlur]).toBe(false);
    expect(flags[FeatureFlagName.IgnoreBackgroundImage]).toBe(false);
  });
});
