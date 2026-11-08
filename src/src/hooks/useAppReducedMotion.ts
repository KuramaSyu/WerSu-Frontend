import { useReducedMotion } from "framer-motion";
import { FeatureFlagName, useFeatureStore } from "../zustand/FeatureStore";

/**
 * Global reduced-motion preference: the OS/browser setting or the
 * Performance mode sub-toggle. Components that run their own animation loop
 * should use this instead of calling framer's `useReducedMotion` directly.
 */
export function useAppReducedMotion(): boolean {
  const systemPreference = useReducedMotion();
  const performanceModePreference = useFeatureStore(
    (s) => s.flags[FeatureFlagName.ReduceMotion],
  );

  return Boolean(systemPreference || performanceModePreference);
}
