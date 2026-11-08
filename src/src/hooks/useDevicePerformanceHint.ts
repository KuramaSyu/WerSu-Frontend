import { useCallback, useEffect, useState } from "react";
import { FeatureFlagName, useFeatureStore } from "../zustand/FeatureStore";

/**
 * Coarse performance classification for the current device/connection.
 *
 * Browsers do not expose a reliable "slow device" signal, so this hook
 * combines a handful of conservative hints and only calls a device
 * constrained when several of them agree. A sub-4G network enables
 * Performance mode automatically; device-only hints are recommendations.
 */
export type PerformanceHint = "fast" | "constrained" | "unknown";

/**
 * The effective network quality reported by the Network Information API.
 * "unknown" means the API is unavailable or the browser did not report a
 * recognised effective type.
 */
export type NetworkQuality =
  | "slow-2g"
  | "2g"
  | "3g"
  | "4g"
  | "5g"
  | "unknown";

export const NETWORK_QUALITY_LABELS: Record<NetworkQuality, string> = {
  "slow-2g": "Slow 2G",
  "2g": "2G",
  "3g": "3G",
  "4g": "4G",
  "5g": "5G",
  unknown: "Unknown",
};

const NETWORK_QUALITIES = new Set<NetworkQuality>([
  "slow-2g",
  "2g",
  "3g",
  "4g",
  "5g",
]);
const BELOW_4G_QUALITIES = new Set<NetworkQuality>(["slow-2g", "2g", "3g"]);

/** Storage key for the one-time "performance mode recommended" notice. */
export const PERFORMANCE_HINT_DISMISSED_KEY = "performance-hint-dismissed";

/** The subset of the Network Information API we rely on. */
export interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

type NavigatorWithHints = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
  deviceMemory?: number;
  userAgentData?: { mobile?: boolean };
};

export interface NetworkQualityInfo {
  /** Normalised effective connection type. */
  quality: NetworkQuality;
  /** Alias for `quality`, for call sites that read the network quality. */
  networkQuality: NetworkQuality;
  /** Human-readable quality label, e.g. "3G". */
  label: string;
  /** Alias for `label`, for call sites that read the network quality. */
  networkQualityLabel: string;
  /** Raw effectiveType reported by the browser, if any. */
  effectiveType: string | null;
  /** The user or browser requested reduced data usage. */
  saveData: boolean;
  /** Estimated downlink in Mbps, if reported. */
  downlink: number | null;
  /** Estimated round-trip time in ms, if reported. */
  rtt: number | null;
  /** True for slow-2g, 2g, and 3g links. */
  isBelow4G: boolean;
  /** True for a sub-4G link, save-data mode, or poor RTT/downlink. */
  isSlow: boolean;
  /** Human-readable reasons, useful for debugging/tests. */
  reasons: string[];
}

export interface DevicePerformanceSignals extends NetworkQualityInfo {
  /** Connection is explicitly slow/save-data. */
  slowConnection: boolean;
  /** Hardware or preference hints suggest a constrained device. */
  constrained: boolean;
}

export function getNetworkInformation(
  nav: Navigator = navigator,
): NetworkInformationLike | null {
  const candidate = nav as NavigatorWithHints;
  return (
    candidate.connection ??
    candidate.mozConnection ??
    candidate.webkitConnection ??
    null
  );
}

/**
 * Estimate a quality when the browser reports downlink/RTT but no
 * recognisable `effectiveType`. The thresholds mirror the Network
 * Information API's rough 2G/3G/4G buckets.
 */
export function inferNetworkQuality(
  connection: NetworkInformationLike | null,
): NetworkQuality {
  if (!connection) return "unknown";

  const downlink =
    typeof connection.downlink === "number" ? connection.downlink : null;
  const rtt = typeof connection.rtt === "number" ? connection.rtt : null;
  if (downlink === null && rtt === null) return "unknown";

  if (rtt !== null && rtt >= 400) return "2g";
  if (downlink !== null && downlink <= 0.8) return "2g";
  if (rtt !== null && rtt >= 300) return "3g";
  if (downlink !== null && downlink <= 1.5) return "3g";
  if (rtt !== null && rtt >= 150) return "3g";
  if (downlink !== null && downlink <= 3) return "3g";
  return "4g";
}

export function getNetworkQuality(
  connection: NetworkInformationLike | null,
): NetworkQuality {
  const effectiveType = connection?.effectiveType;
  if (typeof effectiveType === "string") {
    const normalised = effectiveType.toLowerCase() as NetworkQuality;
    if (NETWORK_QUALITIES.has(normalised)) return normalised;
  }
  return inferNetworkQuality(connection);
}

export function getNetworkQualityLabel(quality: NetworkQuality): string {
  return NETWORK_QUALITY_LABELS[quality];
}

export function isBelow4G(quality: NetworkQuality): boolean {
  return BELOW_4G_QUALITIES.has(quality);
}

/**
 * Synchronous, side-effect-free network quality snapshot. Reads the
 * Network Information API and normalises the effective type plus the
 * coarse RTT/downlink/save-data signals.
 */
export function detectNetworkQuality(
  nav: Navigator = navigator,
): NetworkQualityInfo {
  const connection = getNetworkInformation(nav);
  const quality = getNetworkQuality(connection);
  const reasons: string[] = [];
  let isSlow = false;

  if (connection) {
    if (connection.saveData === true) {
      isSlow = true;
      reasons.push("saveData");
    }
    if (isBelow4G(quality)) {
      isSlow = true;
      reasons.push(`effectiveType:${quality}`);
    }
    if (typeof connection.rtt === "number" && connection.rtt >= 400) {
      isSlow = true;
      reasons.push(`rtt:${connection.rtt}`);
    }
    if (typeof connection.downlink === "number" && connection.downlink <= 0.8) {
      isSlow = true;
      reasons.push(`downlink:${connection.downlink}`);
    }
  }

  return {
    quality,
    networkQuality: quality,
    label: getNetworkQualityLabel(quality),
    networkQualityLabel: getNetworkQualityLabel(quality),
    effectiveType:
      typeof connection?.effectiveType === "string"
        ? connection.effectiveType
        : null,
    saveData: connection?.saveData === true,
    downlink:
      typeof connection?.downlink === "number" ? connection.downlink : null,
    rtt: typeof connection?.rtt === "number" ? connection.rtt : null,
    isBelow4G: isBelow4G(quality),
    isSlow,
    reasons,
  };
}

/**
 * Synchronous, side-effect-free heuristic. Returns the static hints we
 * can read without waiting for runtime frame sampling.
 */
export function detectStaticPerformanceSignals(
  nav: Navigator = navigator,
  win: Window = window,
): DevicePerformanceSignals {
  const network = detectNetworkQuality(nav);
  const reasons = [...network.reasons];

  let constrained = false;
  const candidate = nav as NavigatorWithHints;
  if (
    typeof candidate.hardwareConcurrency === "number" &&
    candidate.hardwareConcurrency > 0 &&
    candidate.hardwareConcurrency <= 4
  ) {
    constrained = true;
    reasons.push(`hardwareConcurrency:${candidate.hardwareConcurrency}`);
  }
  if (
    typeof candidate.deviceMemory === "number" &&
    candidate.deviceMemory > 0 &&
    candidate.deviceMemory <= 4
  ) {
    constrained = true;
    reasons.push(`deviceMemory:${candidate.deviceMemory}`);
  }
  if (candidate.userAgentData?.mobile === true) {
    constrained = true;
    reasons.push("mobile");
  }

  const reducedMotion = win.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  if (reducedMotion) {
    constrained = true;
    reasons.push("prefers-reduced-motion");
  }

  return {
    ...network,
    slowConnection: network.isSlow,
    constrained: constrained || network.isSlow,
    reasons,
  };
}

/**
 * Measure frame pacing for a short window. Returns the p95 frame time in
 * milliseconds. A value above ~30 ms is a useful "this device is busy"
 * signal; a single slow frame is not.
 */
export function sampleFramePacing(durationMs = 1500): Promise<number> {
  return new Promise((resolve) => {
    if (
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      resolve(0);
      return;
    }

    const frameTimes: number[] = [];
    let start = 0;
    let last = 0;
    let cancelled = false;

    const cancel = () => {
      cancelled = true;
    };
    const timeout = window.setTimeout(() => {
      cancel();
      resolve(0);
    }, durationMs + 1000);

    const tick = (now: number) => {
      if (cancelled) return;
      if (start === 0) {
        start = now;
        last = now;
        window.requestAnimationFrame(tick);
        return;
      }
      frameTimes.push(now - last);
      last = now;

      if (now - start >= durationMs) {
        window.clearTimeout(timeout);
        frameTimes.sort((a, b) => a - b);
        const index = Math.min(
          frameTimes.length - 1,
          Math.floor(frameTimes.length * 0.95),
        );
        resolve(frameTimes[index] ?? 0);
        return;
      }
      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  });
}

export interface DevicePerformanceHint {
  hint: PerformanceHint;
  /** Normalised network quality reported by the browser. */
  networkQuality: NetworkQuality;
  /** Human-readable network quality label, e.g. "3G". */
  networkQualityLabel: string;
  /** Alias for `networkQuality`. */
  quality: NetworkQuality;
  /** Alias for `networkQualityLabel`. */
  label: string;
  /** True when the browser reports a 2G/3G/slow-2G link. */
  isBelow4G: boolean;
  /** True when the Network Information API reports a slow/save-data link. */
  isSlowConnection: boolean;
  /** True when static hints or runtime frame pacing suggest a weak device. */
  isConstrained: boolean;
  /** Reasons behind the current classification. */
  reasons: string[];
  /** User dismissed the one-time recommendation. */
  isRecommendationDismissed: boolean;
  dismissRecommendation: () => void;
}

const readDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(PERFORMANCE_HINT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

const writeDismissed = (): void => {
  try {
    window.localStorage.setItem(PERFORMANCE_HINT_DISMISSED_KEY, "1");
  } catch {
    // Private mode / storage disabled: dismissal just won't persist.
  }
};

let lastAutoEnabledQuality: NetworkQuality | null = null;

/**
 * Enable Performance mode when the browser reports a sub-4G link.
 *
 * The helper is idempotent for the same quality: if the user turns
 * Performance mode off while still on 3G, it stays off until the link
 * changes (for example 4G -> 3G or 3G -> 2G).
 */
export function autoEnablePerformanceModeForQuality(
  quality: NetworkQuality,
): boolean {
  if (!isBelow4G(quality)) {
    lastAutoEnabledQuality = null;
    return false;
  }
  if (lastAutoEnabledQuality === quality) return false;
  lastAutoEnabledQuality = quality;

  const { flags, setPerformanceMode } = useFeatureStore.getState();
  if (flags[FeatureFlagName.PerformanceMode]) return false;
  setPerformanceMode(true);
  return true;
}

/** Reset the module-level auto-enable guard between tests. */
export function resetAutoPerformanceModeForTests(): void {
  lastAutoEnabledQuality = null;
}

/**
 * Device/connection performance hint.
 *
 * The first render is synchronous and uses static hints only. A short
 * frame-pacing sample runs after mount and can promote the result to
 * "constrained". The hook deliberately never flips back to "fast" after
 * runtime sampling, so a transient slow patch does not cause UI thrash.
 */
export function useDevicePerformanceHint(
  options: { sampleRuntime?: boolean } = {},
): DevicePerformanceHint {
  const { sampleRuntime = true } = options;
  const [signals, setSignals] = useState<DevicePerformanceSignals>(() =>
    detectStaticPerformanceSignals(),
  );
  const [runtimeConstrained, setRuntimeConstrained] = useState(false);
  const [isRecommendationDismissed, setRecommendationDismissed] =
    useState(readDismissed);

  // Re-read connection hints when the browser reports a change (e.g.
  // Wi-Fi -> cellular) without resampling the frame budget.
  useEffect(() => {
    const connection = getNetworkInformation();
    if (!connection?.addEventListener) return;
    const update = () => setSignals(detectStaticPerformanceSignals());
    connection.addEventListener("change", update);
    return () => connection.removeEventListener?.("change", update);
  }, []);

  // A sub-4G connection is enough to turn Performance mode on without
  // waiting for the settings page or a user click. The helper only fires
  // once per quality so a manual opt-out is not immediately undone.
  useEffect(() => {
    autoEnablePerformanceModeForQuality(signals.networkQuality);
  }, [signals.networkQuality]);

  useEffect(() => {
    if (!sampleRuntime) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void sampleFramePacing().then((p95) => {
        if (cancelled) return;
        // ~30 ms p95 ≈ under 34 fps; enough to suggest Performance mode.
        if (p95 > 30) setRuntimeConstrained(true);
      });
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sampleRuntime]);

  const dismissRecommendation = useCallback(() => {
    writeDismissed();
    setRecommendationDismissed(true);
  }, []);

  const isSlowConnection = signals.slowConnection;
  const isConstrained = signals.constrained || runtimeConstrained;
  const hint: PerformanceHint = isConstrained
    ? "constrained"
    : signals.reasons.length === 0
      ? "fast"
      : "unknown";

  return {
    hint,
    networkQuality: signals.networkQuality,
    networkQualityLabel: signals.networkQualityLabel,
    quality: signals.networkQuality,
    label: signals.networkQualityLabel,
    isBelow4G: signals.isBelow4G,
    isSlowConnection,
    isConstrained,
    reasons: signals.reasons,
    isRecommendationDismissed,
    dismissRecommendation,
  };
}
