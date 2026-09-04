import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Enum with all feature flag names for autocompletion.
 *
 * Add new flags here AND to `DEFAULT_FEATURE_FLAGS` so a missing
 * entry is a compile error, not a silent `undefined`.
 */
export enum FeatureFlagName {
  DeveloperMode = "DeveloperMode",
  /**
   * When true, the MSW worker intercepts every `/api/*` request and
   * returns fixture data instead of hitting the real backend. Only
   * surfaced in the Settings UI when `DeveloperMode` is also on, so
   * end users cannot accidentally enable it.
   */
  UseFakeApi = "UseFakeApi",
}

const FEATURE_FLAG_NAMES = Object.values(FeatureFlagName);

/**
 * Default values for every feature flag. Used both for reset and
 * as the hydration fallback when the persisted shape is missing a
 * flag (e.g. after we ship a new flag to a returning user).
 */
const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagName, boolean> = {
  [FeatureFlagName.DeveloperMode]: false,
  [FeatureFlagName.UseFakeApi]: false,
};

const isBooleanRecord = (
  value: unknown,
): value is Record<string, boolean> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Feature flag store.
 *
 * Flags are simple booleans for now — the `FeatureFlagName` enum
 * keeps the call sites type-safe, the store persists to
 * `localStorage` so a user's developer-mode choice survives
 * browser restarts, and the defensive `merge` keeps the store
 * crash-free if a persisted shape is missing or has unknown keys.
 */
interface FeatureFlagsState {
  flags: Record<FeatureFlagName, boolean>;
  setFlag: (name: FeatureFlagName, value: boolean) => void;
  resetFlags: () => void;
}

export const useFeatureStore = create<FeatureFlagsState>()(
  persist(
    (set) => ({
      flags: { ...DEFAULT_FEATURE_FLAGS },
      setFlag: (name, value) =>
        set((state) => ({ flags: { ...state.flags, [name]: value } })),
      resetFlags: () => set({ flags: { ...DEFAULT_FEATURE_FLAGS } }),
    }),
    {
      name: "feature-flags",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ flags: state.flags }),
      merge: (persisted, current) => {
        // Defensive: an old/foreign shape must not crash the store.
        const p = (persisted ?? {}) as Partial<FeatureFlagsState>;
        const persistedFlags = isBooleanRecord(p.flags) ? p.flags : {};
        const merged: Record<FeatureFlagName, boolean> = {
          ...DEFAULT_FEATURE_FLAGS,
        };
        for (const name of FEATURE_FLAG_NAMES) {
          const value = persistedFlags[name];
          merged[name] = typeof value === "boolean" ? value : merged[name];
        }
        return { ...current, flags: merged };
      },
    },
  ),
);
