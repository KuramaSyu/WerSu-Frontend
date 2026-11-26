import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MostUsedAlgorithm } from "../api/models/history";

/** Persisted storage key; versioned so shape changes can migrate safely. */
const STORAGE_KEY = "personalization-settings-storage";
const STORAGE_VERSION = 1;

/** Algorithms the backend can rank the frequently-used list with. */
export const FREQUENTLY_USED_ALGORITHMS: readonly MostUsedAlgorithm[] = [
  "MOST_USED_ALGORITHM_LOG_COUNT",
  "MOST_USED_ALGORITHM_COUNT",
] as const;

export const FREQUENTLY_USED_ALGORITHM_LABEL: Record<
  MostUsedAlgorithm,
  string
> = {
  MOST_USED_ALGORITHM_UNSPECIFIED: "Backend default",
  MOST_USED_ALGORITHM_COUNT: "Raw count",
  MOST_USED_ALGORITHM_LOG_COUNT: "Log count",
};

export const FREQUENTLY_USED_ALGORITHM_DESCRIPTION: Record<
  MostUsedAlgorithm,
  string
> = {
  MOST_USED_ALGORITHM_UNSPECIFIED: "Leave the ranking to the backend default.",
  MOST_USED_ALGORITHM_COUNT:
    "Every open adds one point. Popular notes can run away with the list.",
  MOST_USED_ALGORITHM_LOG_COUNT:
    "Each open adds a shrinking amount of score, so a handful of favourites cannot drown out everything else.",
};

/** How the backend counts repeat opens of the same note. */
export type FrequentlyUsedCounting =
  "backend_default" | "unique_per_day" | "every_call";

export interface FrequentlyUsedCountingOption {
  /** Stored value. */
  value: FrequentlyUsedCounting;
  /** Menu label. */
  label: string;
  /** One-line explanation. */
  description: string;
  /** `unique_per_day` wire value; `undefined` leaves the backend default. */
  uniquePerDay: boolean | undefined;
}

export const FREQUENTLY_USED_COUNTING_OPTIONS: FrequentlyUsedCountingOption[] =
  [
    {
      value: "backend_default",
      label: "Backend default",
      description: "Let the backend decide how repeat opens are counted.",
      uniquePerDay: undefined,
    },
    {
      value: "unique_per_day",
      label: "Max one per day",
      description:
        "A note scores at most once per day, no matter how often you open it.",
      uniquePerDay: true,
    },
    {
      value: "every_call",
      label: "Count every call",
      description:
        "Every view adds score, so a note you keep reopening climbs faster.",
      uniquePerDay: false,
    },
  ];

/** Resolves the stored counting mode to the `unique_per_day` wire value. */
export const uniquePerDayForCounting = (
  counting: FrequentlyUsedCounting,
): boolean | undefined =>
  FREQUENTLY_USED_COUNTING_OPTIONS.find((option) => option.value === counting)
    ?.uniquePerDay;

/** Time windows offered for the Home left rail. `null` means all time. */
export interface RailWindowOption {
  /** Stable key used for the select value. */
  key: string;
  /** Human label rendered in the menu. */
  label: string;
  /** Days handed to the backend; `null` omits the `days` filter. */
  days: number | null;
}

export const RAIL_WINDOW_OPTIONS: RailWindowOption[] = [
  { key: "all", label: "All time", days: null },
  { key: "1", label: "Today", days: 1 },
  { key: "3", label: "3 days", days: 3 },
  { key: "7", label: "1 week", days: 7 },
  { key: "14", label: "2 weeks", days: 14 },
  { key: "30", label: "1 month", days: 30 },
  { key: "90", label: "3 months", days: 90 },
  { key: "360", label: "1 year", days: 360 },
];

export const DEFAULT_FREQUENTLY_USED_DAYS: number | null = null;
export const DEFAULT_FREQUENTLY_USED_ALGORITHM: MostUsedAlgorithm =
  "MOST_USED_ALGORITHM_LOG_COUNT";
export const DEFAULT_FREQUENTLY_USED_COUNTING: FrequentlyUsedCounting =
  "backend_default";
export const DEFAULT_FREQUENTLY_USED_RAIL_LIMIT = 8;
export const DEFAULT_LAST_USED_DAYS = 30;
export const DEFAULT_LAST_USED_RAIL_LIMIT = 3;

/** Bounds for the rail entry-count sliders. */
export const MIN_RAIL_LIMIT = 3;
export const MAX_RAIL_LIMIT = 25;

/**
 * Personalization preferences for the Home page's left rail.
 *
 * These control how the backend is queried for the "Frequently used" and
 * "Last used" blocks: the time window, the ranking algorithm, whether a
 * note can score at most once per day, and how many rows are shown.
 * Persisted to localStorage so the choice survives reloads.
 */
export interface PersonalizationSettingsState {
  /** Days of history the frequently-used block counts; `null` = all time. */
  frequentlyUsedDays: number | null;
  /** Scoring algorithm the backend aggregates with. */
  frequentlyUsedAlgorithm: MostUsedAlgorithm;
  /** How the backend counts repeat opens of the same note. */
  frequentlyUsedCounting: FrequentlyUsedCounting;
  /** Max rows rendered in the frequently-used block. */
  frequentlyUsedRailLimit: number;

  /** Days of history the last-used block counts. */
  lastUsedDays: number;
  /** Max rows rendered in the last-used block. */
  lastUsedRailLimit: number;

  setFrequentlyUsedDays: (days: number | null) => void;
  setFrequentlyUsedAlgorithm: (algorithm: MostUsedAlgorithm) => void;
  setFrequentlyUsedCounting: (counting: FrequentlyUsedCounting) => void;
  setFrequentlyUsedRailLimit: (limit: number) => void;
  setLastUsedDays: (days: number) => void;
  setLastUsedRailLimit: (limit: number) => void;
  /** Restore every preference to its default. */
  reset: () => void;
}

const clampLimit = (value: number): number =>
  Math.min(MAX_RAIL_LIMIT, Math.max(MIN_RAIL_LIMIT, Math.round(value)));

const isValidDays = (value: unknown, allowNull: boolean): boolean => {
  if (allowNull && value === null) {
    return true;
  }
  return typeof value === "number" && Number.isFinite(value) && value > 0;
};

const isValidAlgorithm = (value: unknown): value is MostUsedAlgorithm =>
  typeof value === "string" &&
  (FREQUENTLY_USED_ALGORITHMS as readonly string[]).includes(value);

const isValidCounting = (value: unknown): value is FrequentlyUsedCounting =>
  typeof value === "string" &&
  FREQUENTLY_USED_COUNTING_OPTIONS.some((option) => option.value === value);

const defaults = {
  frequentlyUsedDays: DEFAULT_FREQUENTLY_USED_DAYS,
  frequentlyUsedAlgorithm: DEFAULT_FREQUENTLY_USED_ALGORITHM,
  frequentlyUsedCounting: DEFAULT_FREQUENTLY_USED_COUNTING,
  frequentlyUsedRailLimit: DEFAULT_FREQUENTLY_USED_RAIL_LIMIT,
  lastUsedDays: DEFAULT_LAST_USED_DAYS,
  lastUsedRailLimit: DEFAULT_LAST_USED_RAIL_LIMIT,
};

export const usePersonalizationSettings =
  create<PersonalizationSettingsState>()(
    persist(
      (set) => ({
        ...defaults,
        setFrequentlyUsedDays: (days) => set({ frequentlyUsedDays: days }),
        setFrequentlyUsedAlgorithm: (algorithm) =>
          set({ frequentlyUsedAlgorithm: algorithm }),
        setFrequentlyUsedCounting: (counting) =>
          set({ frequentlyUsedCounting: counting }),
        setFrequentlyUsedRailLimit: (limit) =>
          set({ frequentlyUsedRailLimit: clampLimit(limit) }),
        setLastUsedDays: (days) =>
          set({ lastUsedDays: Math.max(1, Math.round(days)) }),
        setLastUsedRailLimit: (limit) =>
          set({ lastUsedRailLimit: clampLimit(limit) }),
        reset: () => set(defaults),
      }),
      {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        version: STORAGE_VERSION,
        partialize: (state) => ({
          frequentlyUsedDays: state.frequentlyUsedDays,
          frequentlyUsedAlgorithm: state.frequentlyUsedAlgorithm,
          frequentlyUsedCounting: state.frequentlyUsedCounting,
          frequentlyUsedRailLimit: state.frequentlyUsedRailLimit,
          lastUsedDays: state.lastUsedDays,
          lastUsedRailLimit: state.lastUsedRailLimit,
        }),
        merge: (persisted, current) => {
          // Defensive: an old or hand-edited shape must never crash the store.
          const p = (persisted ?? {}) as Partial<PersonalizationSettingsState>;
          return {
            ...current,
            frequentlyUsedDays: isValidDays(p.frequentlyUsedDays, true)
              ? (p.frequentlyUsedDays as number | null)
              : current.frequentlyUsedDays,
            frequentlyUsedAlgorithm: isValidAlgorithm(p.frequentlyUsedAlgorithm)
              ? p.frequentlyUsedAlgorithm
              : current.frequentlyUsedAlgorithm,
            frequentlyUsedCounting: isValidCounting(p.frequentlyUsedCounting)
              ? p.frequentlyUsedCounting
              : current.frequentlyUsedCounting,
            frequentlyUsedRailLimit: isValidDays(
              p.frequentlyUsedRailLimit,
              false,
            )
              ? clampLimit(p.frequentlyUsedRailLimit as number)
              : current.frequentlyUsedRailLimit,
            lastUsedDays: isValidDays(p.lastUsedDays, false)
              ? (p.lastUsedDays as number)
              : current.lastUsedDays,
            lastUsedRailLimit: isValidDays(p.lastUsedRailLimit, false)
              ? clampLimit(p.lastUsedRailLimit as number)
              : current.lastUsedRailLimit,
          };
        },
      },
    ),
  );
