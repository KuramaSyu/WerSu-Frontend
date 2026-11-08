// @vitest-environment jsdom

import "../test/setup";

import { describe, expect, it } from "vitest";
import {
  detectStaticPerformanceSignals,
  getNetworkInformation,
  type NetworkInformationLike,
} from "./useDevicePerformanceHint";

const makeNavigator = (
  hints: {
    connection?: NetworkInformationLike;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    mobile?: boolean;
  } = {},
): Navigator => {
  const nav = {
    hardwareConcurrency: hints.hardwareConcurrency,
    deviceMemory: hints.deviceMemory,
    connection: hints.connection,
    userAgentData:
      hints.mobile === undefined ? undefined : { mobile: hints.mobile },
  };
  return nav as unknown as Navigator;
};

const makeWindow = (reducedMotion = false): Window =>
  ({
    matchMedia: () => ({ matches: reducedMotion }),
  }) as unknown as Window;

describe("getNetworkInformation()", () => {
  it("returns the Network Information API connection", () => {
    const connection = { effectiveType: "4g" };
    expect(getNetworkInformation(makeNavigator({ connection }))).toBe(
      connection,
    );
  });

  it("returns null when the API is unavailable", () => {
    expect(getNetworkInformation(makeNavigator())).toBeNull();
  });
});

describe("detectStaticPerformanceSignals()", () => {
  it("flags save-data connections as slow", () => {
    const result = detectStaticPerformanceSignals(
      makeNavigator({ connection: { saveData: true } }),
      makeWindow(),
    );
    expect(result.slowConnection).toBe(true);
    expect(result.reasons).toContain("saveData");
  });

  it.each(["slow-2g", "2g", "3g"])(
    "flags effectiveType %s as slow",
    (effectiveType) => {
      const result = detectStaticPerformanceSignals(
        makeNavigator({ connection: { effectiveType } }),
        makeWindow(),
      );
      expect(result.slowConnection).toBe(true);
      expect(result.reasons).toContain(`effectiveType:${effectiveType}`);
    },
  );

  it("flags high RTT and low downlink as slow", () => {
    const result = detectStaticPerformanceSignals(
      makeNavigator({ connection: { rtt: 450, downlink: 0.5 } }),
      makeWindow(),
    );
    expect(result.slowConnection).toBe(true);
    expect(result.reasons).toContain("rtt:450");
    expect(result.reasons).toContain("downlink:0.5");
  });

  it("flags low core count and low device memory as constrained", () => {
    const result = detectStaticPerformanceSignals(
      makeNavigator({ hardwareConcurrency: 4, deviceMemory: 2 }),
      makeWindow(),
    );
    expect(result.constrained).toBe(true);
    expect(result.reasons).toContain("hardwareConcurrency:4");
    expect(result.reasons).toContain("deviceMemory:2");
  });

  it("treats mobile user agents and reduced-motion as constrained", () => {
    const result = detectStaticPerformanceSignals(
      makeNavigator({ mobile: true }),
      makeWindow(true),
    );
    expect(result.constrained).toBe(true);
    expect(result.reasons).toContain("mobile");
    expect(result.reasons).toContain("prefers-reduced-motion");
  });

  it("returns no signals for a capable desktop", () => {
    const result = detectStaticPerformanceSignals(
      makeNavigator({
        connection: { effectiveType: "4g", downlink: 10, rtt: 50 },
        hardwareConcurrency: 12,
        deviceMemory: 16,
        mobile: false,
      }),
      makeWindow(false),
    );
    expect(result.slowConnection).toBe(false);
    expect(result.constrained).toBe(false);
    expect(result.reasons).toEqual([]);
  });
});
