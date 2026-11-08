// @vitest-environment jsdom

import "../test/setup";

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  autoEnablePerformanceModeForQuality,
  detectNetworkQuality,
  detectStaticPerformanceSignals,
  getNetworkInformation,
  getNetworkQuality,
  getNetworkQualityLabel,
  isBelow4G,
  resetAutoPerformanceModeForTests,
  useDevicePerformanceHint,
  type NetworkInformationLike,
} from "./useDevicePerformanceHint";
import { FeatureFlagName, useFeatureStore } from "../zustand/FeatureStore";

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

const originalConnection = Object.getOwnPropertyDescriptor(
  navigator,
  "connection",
);

const setConnection = (connection: NetworkInformationLike | undefined) => {
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: connection,
  });
};

afterEach(() => {
  if (originalConnection) {
    Object.defineProperty(navigator, "connection", originalConnection);
  } else {
    delete (navigator as Navigator & { connection?: NetworkInformationLike })
      .connection;
  }
});

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

describe("getNetworkQuality()", () => {
  it.each(["slow-2g", "2g", "3g", "4g"] as const)(
    "normalises effectiveType %s",
    (effectiveType) => {
      expect(getNetworkQuality({ effectiveType })).toBe(effectiveType);
      expect(getNetworkQualityLabel(effectiveType)).toBe(
        effectiveType === "slow-2g"
          ? "Slow 2G"
          : effectiveType.toUpperCase(),
      );
    },
  );

  it("returns unknown when the API is unavailable", () => {
    expect(getNetworkQuality(null)).toBe("unknown");
    expect(getNetworkQualityLabel("unknown")).toBe("Unknown");
  });

  it("recognises 5G effective types", () => {
    expect(getNetworkQuality({ effectiveType: "5g" })).toBe("5g");
    expect(getNetworkQualityLabel("5g")).toBe("5G");
  });

  it("infers quality from downlink/RTT when effectiveType is missing", () => {
    expect(getNetworkQuality({ downlink: 0.5 })).toBe("2g");
    expect(getNetworkQuality({ downlink: 1.2 })).toBe("3g");
    expect(getNetworkQuality({ downlink: 2.5 })).toBe("3g");
    expect(getNetworkQuality({ downlink: 10, rtt: 50 })).toBe("4g");
    expect(getNetworkQuality({ rtt: 450 })).toBe("2g");
    expect(getNetworkQuality({ rtt: 250 })).toBe("3g");
    expect(getNetworkQuality({ saveData: true })).toBe("unknown");
  });

  it("only treats slow-2g, 2g, and 3g as below 4G", () => {
    expect(isBelow4G("slow-2g")).toBe(true);
    expect(isBelow4G("2g")).toBe(true);
    expect(isBelow4G("3g")).toBe(true);
    expect(isBelow4G("4g")).toBe(false);
    expect(isBelow4G("unknown")).toBe(false);
  });
});

describe("detectNetworkQuality()", () => {
  it("reports the effective type and its label", () => {
    const result = detectNetworkQuality(
      makeNavigator({ connection: { effectiveType: "3g" } }),
    );
    expect(result.quality).toBe("3g");
    expect(result.label).toBe("3G");
    expect(result.isBelow4G).toBe(true);
    expect(result.isSlow).toBe(true);
    expect(result.reasons).toContain("effectiveType:3g");
  });

  it("does not mark 4G as below 4G", () => {
    const result = detectNetworkQuality(
      makeNavigator({ connection: { effectiveType: "4g" } }),
    );
    expect(result.quality).toBe("4g");
    expect(result.label).toBe("4G");
    expect(result.isBelow4G).toBe(false);
    expect(result.isSlow).toBe(false);
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
    expect(result.networkQuality).toBe("4g");
    expect(result.networkQualityLabel).toBe("4G");
    expect(result.isBelow4G).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("exposes the actual network quality alongside device hints", () => {
    const result = detectStaticPerformanceSignals(
      makeNavigator({ connection: { effectiveType: "3g" } }),
      makeWindow(),
    );
    expect(result.networkQuality).toBe("3g");
    expect(result.networkQualityLabel).toBe("3G");
    expect(result.isBelow4G).toBe(true);
  });
});

describe("useDevicePerformanceHint()", () => {
  beforeEach(() => {
    resetAutoPerformanceModeForTests();
    useFeatureStore.getState().setPerformanceMode(false);
  });

  it("auto-enables Performance mode when the network is below 4G", () => {
    setConnection({ effectiveType: "3g" });

    renderHook(() => useDevicePerformanceHint({ sampleRuntime: false }));

    expect(
      useFeatureStore.getState().flags[FeatureFlagName.PerformanceMode],
    ).toBe(true);
  });

  it("does not auto-enable Performance mode on 4G", () => {
    setConnection({ effectiveType: "4g" });

    renderHook(() => useDevicePerformanceHint({ sampleRuntime: false }));

    expect(
      useFeatureStore.getState().flags[FeatureFlagName.PerformanceMode],
    ).toBe(false);
  });
});

describe("autoEnablePerformanceModeForQuality()", () => {
  beforeEach(() => {
    resetAutoPerformanceModeForTests();
    useFeatureStore.getState().setPerformanceMode(false);
  });

  it("enables Performance mode for sub-4G links", () => {
    expect(autoEnablePerformanceModeForQuality("3g")).toBe(true);
    expect(
      useFeatureStore.getState().flags[FeatureFlagName.PerformanceMode],
    ).toBe(true);
  });

  it("does not enable Performance mode for 4G or unknown", () => {
    expect(autoEnablePerformanceModeForQuality("4g")).toBe(false);
    expect(autoEnablePerformanceModeForQuality("unknown")).toBe(false);
    expect(
      useFeatureStore.getState().flags[FeatureFlagName.PerformanceMode],
    ).toBe(false);
  });

  it("does not repeatedly override a manual opt-out at the same quality", () => {
    expect(autoEnablePerformanceModeForQuality("3g")).toBe(true);
    useFeatureStore.getState().setPerformanceMode(false);
    expect(autoEnablePerformanceModeForQuality("3g")).toBe(false);
    expect(
      useFeatureStore.getState().flags[FeatureFlagName.PerformanceMode],
    ).toBe(false);
  });
});
