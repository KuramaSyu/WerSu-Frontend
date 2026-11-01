import { setCookie } from '../utils/cookies';
import { z } from 'zod';

// -----------------------------------------------------------------------------
// Legacy cookie-backed preferences
// -----------------------------------------------------------------------------

/**
 * Legacy cookie-backed preferences.
 * @deprecated The `/api/preferences` blob (see `PreferencesData` below) is
 * the canonical store. This shape is kept only for the old `preferences`
 * cookie reader in `utils/cookiePreferences.ts`.
 */
export const UserPreferencesSchema = z.object({
  theme: z.string()
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// used for custom overrides, if default definitions are not good enough
export interface OverrideSportDefinition {
  sport: string;
  game: string;
  amount: number;
}
export interface DefaultSportsDefinition {
  sport: string | null;
  sport_multiplier: number | null;
  game: string | null;
  game_multiplier: number | null;
}

export interface Multiplier {
  game: string | null; // null means it's used global
  sport: string | null; // null means it's used for all sports
  multiplier: number;
}



export interface OtherPreferences {
  instant_open_modal: boolean; // whether or not to open the quick action modal with every key
}

export interface UIElement {
  name: string;
  isDisplayed: boolean;
}

export interface UIPreferences {
  displayedGames: UIElement[] | null; // null means, all Games will be shown
  displayedSports: UIElement[] | null; // null means, all Sports will be shown
}

export interface SportSpecific {
  plank: PlankSettings;
}

export interface PlankSettings {
  seconds: number; // this number will be the amount of seconds, with max_deaths
}

export function defaultPreferences(): UserPreferences {
  return {
    theme: "nord-dark"
  }
}

// -----------------------------------------------------------------------------
// Server-synced preferences blob (`/api/preferences`)
// -----------------------------------------------------------------------------

/**
 * Bump when the stored `PreferencesData` shape changes incompatibly so
 * readers can migrate or ignore the payload.
 */
export const PREFERENCES_VERSION = 1;

/**
 * How the active theme mode is chosen.
 *
 * - `"light"` / `"dark"` pin the mode explicitly.
 * - `"system"` follows the OS `prefers-color-scheme` setting.
 */
export const ThemeModePreferenceSchema = z.enum([
  "light",
  "dark",
  "system",
]);
export type ThemeModePreference = z.infer<typeof ThemeModePreferenceSchema>;

/**
 * A user's synced theme preference, expressed per mode instead of per
 * viewport. This is deliberately *not* device-specific: it is the value
 * stored in the cloud `/api/preferences` blob and applies wherever the
 * user has not pinned a local override (see `useThemeStore.themeLocked`).
 *
 * `light` / `dark` hold theme-name slugs (matching `themeName` in
 * `useThemeStore`), or `null` to fall back to the current/default theme
 * for that mode.
 */
export const ThemePreferenceSchema = z.object({
  mode: ThemeModePreferenceSchema,
  light: z.string().nullable(),
  dark: z.string().nullable(),
});
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

/**
 * The typed preferences payload. The API carries it in the
 * `preferences_json` field as a JSON-encoded string; this schema is what
 * the frontend writes and parses back.
 */
export const PreferencesDataSchema = z.object({
  version: z.number().int().nonnegative(),
  theme: ThemePreferenceSchema,
});
export type PreferencesData = z.infer<typeof PreferencesDataSchema>;

/**
 * Parse a stored preferences blob defensively.
 *
 * Returns `null` when the payload is missing or does not match the
 * current shape (e.g. an older `version` written by another client).
 * Callers should fall back to defaults in that case rather than throw.
 */
export function parsePreferencesData(value: unknown): PreferencesData | null {
  const result = PreferencesDataSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Decode the API's `preferences_json` field.
 *
 * The backend transports the blob as a JSON-encoded *string*, but be
 * defensive: an already-parsed object (e.g. from a mock or a future
 * backend change) is accepted too. Returns `null` when the value is
 * absent or does not match the current `PreferencesData` shape.
 */
export function parseStoredPreferences(value: unknown): PreferencesData | null {
  if (typeof value === "string") {
    try {
      return parsePreferencesData(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return parsePreferencesData(value);
}
export function savePreferences(p: UserPreferences): void {
  setCookie('preferences', JSON.stringify(p), 9999);
}
