// Tier-1 unit test for `usePersonalizationSettings`.
//
// Behaviour we care about:
//   - The Home rail defaults match the pre-personalize behaviour
//     (all time, log-count ranking, backend-default counting).
//   - The counting mode maps onto the `unique_per_day` wire value,
//     including `undefined` for "leave it to the backend".
//   - Row-count setters clamp into the slider bounds and `reset()`
//     restores every default.

// @vitest-environment jsdom

import "../test/setup";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_FREQUENTLY_USED_ALGORITHM,
  DEFAULT_FREQUENTLY_USED_DAYS,
  DEFAULT_FREQUENTLY_USED_RAIL_LIMIT,
  MAX_RAIL_LIMIT,
  MIN_RAIL_LIMIT,
  uniquePerDayForCounting,
  usePersonalizationSettings,
} from "./usePersonalizationSettings";

describe("usePersonalizationSettings", () => {
  it("defaults to the pre-personalize rail behaviour", () => {
    const state = usePersonalizationSettings.getState();
    expect(state.frequentlyUsedDays).toBe(DEFAULT_FREQUENTLY_USED_DAYS);
    expect(state.frequentlyUsedAlgorithm).toBe(
      DEFAULT_FREQUENTLY_USED_ALGORITHM,
    );
    expect(state.frequentlyUsedCounting).toBe("backend_default");
    expect(state.frequentlyUsedRailLimit).toBe(
      DEFAULT_FREQUENTLY_USED_RAIL_LIMIT,
    );
  });

  it("maps counting modes onto unique_per_day", () => {
    expect(uniquePerDayForCounting("backend_default")).toBeUndefined();
    expect(uniquePerDayForCounting("unique_per_day")).toBe(true);
    expect(uniquePerDayForCounting("every_call")).toBe(false);
  });

  it("clamps row-count setters into the slider bounds", () => {
    usePersonalizationSettings.getState().setFrequentlyUsedRailLimit(999);
    expect(usePersonalizationSettings.getState().frequentlyUsedRailLimit).toBe(
      MAX_RAIL_LIMIT,
    );
    usePersonalizationSettings.getState().setLastUsedRailLimit(0);
    expect(usePersonalizationSettings.getState().lastUsedRailLimit).toBe(
      MIN_RAIL_LIMIT,
    );
  });

  it("reset restores every default", () => {
    usePersonalizationSettings.getState().setFrequentlyUsedDays(7);
    usePersonalizationSettings
      .getState()
      .setFrequentlyUsedAlgorithm("MOST_USED_ALGORITHM_COUNT");
    usePersonalizationSettings
      .getState()
      .setFrequentlyUsedCounting("every_call");

    usePersonalizationSettings.getState().reset();

    const state = usePersonalizationSettings.getState();
    expect(state.frequentlyUsedDays).toBe(DEFAULT_FREQUENTLY_USED_DAYS);
    expect(state.frequentlyUsedAlgorithm).toBe(
      DEFAULT_FREQUENTLY_USED_ALGORITHM,
    );
    expect(state.frequentlyUsedCounting).toBe("backend_default");
    expect(state.frequentlyUsedRailLimit).toBe(
      DEFAULT_FREQUENTLY_USED_RAIL_LIMIT,
    );
  });
});
