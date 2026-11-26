import { z } from "zod";
import type { MostUsedAlgorithm } from "../api/models/history";

/** `key` query/body field that selects the personalization preferences row. */
export const PERSONALIZATION_PREFERENCE_KEY = "personalization";

/** Bump when the stored payload shape changes incompatibly. */
export const PERSONALIZATION_VERSION = 1;

/** Bounds shared by the rail row-count controls. */
export const MIN_PERSONALIZATION_RAIL_LIMIT = 3;
export const MAX_PERSONALIZATION_RAIL_LIMIT = 25;

/** How the backend counts repeat opens of the same note. */
export type FrequentlyUsedCounting =
  | "backend_default"
  | "unique_per_day"
  | "every_call";

const MostUsedAlgorithmSchema = z.enum([
  "MOST_USED_ALGORITHM_UNSPECIFIED",
  "MOST_USED_ALGORITHM_COUNT",
  "MOST_USED_ALGORITHM_LOG_COUNT",
]);

const FrequentlyUsedCountingSchema = z.enum([
  "backend_default",
  "unique_per_day",
  "every_call",
]);

const railLimit = z
  .number()
  .int()
  .min(MIN_PERSONALIZATION_RAIL_LIMIT)
  .max(MAX_PERSONALIZATION_RAIL_LIMIT);

/**
 * Payload stored in the `personalization` preference row.
 *
 * Lives in the cloud `/api/preferences` blob (`scope: "user"`, key
 * `personalization`) so the Home rail behaves the same on every device the
 * user signs in to.
 */
export const PersonalizationDataSchema = z.object({
  version: z.number().int().nonnegative(),
  /** Days of history the frequently-used rail counts; `null` = all time. */
  frequentlyUsedDays: z.number().positive().nullable(),
  frequentlyUsedAlgorithm: MostUsedAlgorithmSchema,
  frequentlyUsedCounting: FrequentlyUsedCountingSchema,
  frequentlyUsedRailLimit: railLimit,
  lastUsedDays: z.number().positive(),
  lastUsedRailLimit: railLimit,
});

export type PersonalizationData = z.infer<typeof PersonalizationDataSchema>;

/** Defaults; deliberately match the rail's pre-personalize behaviour. */
export function defaultPersonalizationData(): PersonalizationData {
  return {
    version: PERSONALIZATION_VERSION,
    frequentlyUsedDays: null,
    frequentlyUsedAlgorithm: "MOST_USED_ALGORITHM_LOG_COUNT",
    frequentlyUsedCounting: "backend_default",
    frequentlyUsedRailLimit: 8,
    lastUsedDays: 30,
    lastUsedRailLimit: 3,
  };
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Parse a stored `personalization` payload defensively.
 *
 * The API transports `preferences_json` as a JSON-encoded string, but an
 * already-parsed object is accepted too. Returns `null` when the payload is
 * absent or does not match the current shape; callers fall back to defaults.
 */
export function parsePersonalizationData(
  value: unknown,
): PersonalizationData | null {
  const raw = typeof value === "string" ? safeJsonParse(value) : value;
  const result = PersonalizationDataSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Encode a payload for the API's `preferences_json` field. */
export function serializePersonalizationData(
  data: PersonalizationData,
): string {
  return JSON.stringify(data);
}
