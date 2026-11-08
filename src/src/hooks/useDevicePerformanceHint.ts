import { useCallback, useEffect, useState } from "react";

/**
 * Coarse performance classification for the current device/connection.
 *
 * Browsers do not expose a reliable "slow device" signal, so this hook
 * combines a handful of conservative hints and only calls a device
 * constrained when several of them agree. The result is used to suggest
 * Performance mode, never to silently enable it.
 */
export type PerformanceHint = "fast" | "constrained" | "unknown";

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

export interface DevicePerformanceSignals {
  /** Connection is explicitly slow/save-data. */
  slowConnection: boolean;
  /** Hardware or preference hints suggest a constrained device. */
  constrained: boolean;
  /** Human-readable reasons, useful for debugging/tests. */
  reasons: string[];
}

const SLOW_EFFECTIVE_TYPES = new Set(["slow-2g", "2g", "3g"]);

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
 * Synchronous, side-effect-free heuristic. Returns the static hints we
 * can read without waiting for runtime frame sampling.
 */
export function detectStaticPerformanceSignals(
  nav: Navigator = navigator,
  win: Window = window,
): DevicePerformanceSignals {
  const reasons: string[] = [];
  const connection = getNetworkInformation(nav);

  let slowConnection = false;
  if (connection) {
    if (connection.saveData === true) {
      slowConnection = true;
      reasons.push("saveData");
    }
    if (
      typeof connection.effectiveType === "string" &&
      SLOW_EFFECTIVE_TYPES.has(connection.effectiveType)
    ) {
      slowConnection = true;
      reasons.push(`effectiveType:${connection.effectiveType}`);
    }
    if (typeof connection.rtt === "number" && connection.rtt >= 400) {
      slowConnection = true;
      reasons.push(`rtt:${connection.rtt}`);
    }
    if (typeof connection.downlink === "number" && connection.downlink <= 0.8) {
      slowConnection = true;
      reasons.push(`downlink:${connection.downlink}`);
    }
  }

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
  ).matches;
  if (reducedMotion) {
    constrained = true;
    reasons.push("prefers-reduced-motion");
  }

  return {
    slowConnection,
    constrained: constrained || slowConnection,
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
    isSlowConnection,
    isConstrained,
    reasons: signals.reasons,
    isRecommendationDismissed,
    dismissRecommendation,
  };
}
