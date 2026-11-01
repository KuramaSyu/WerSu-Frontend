import { z } from "zod";
import {
  isGeneratedThemeRecord,
  normalizeGeneratedThemeRecord,
  type GeneratedThemeRecord,
} from "../theme/imageTheme";
import { ThemePreferenceSchema, type ThemePreference } from "./Preferences";

/**
 * Keyed preferences blob that carries custom (image-generated) themes.
 *
 * Custom themes are stored per owner under `scope: "user" | "shelf"` with
 * `key: "custom-themes"`. Splitting them out of the default preferences
 * blob keeps the active-theme selection small while still letting a shelf
 * ship a whole theme (colors + background image URL) to every member.
 *
 * A theme's ownership is encoded by *which* row it lives in: a theme in a
 * user row is personal, a theme in a shelf row belongs to that shelf.
 */

/** `key` query/body field that selects this preferences row. */
export const CUSTOM_THEMES_PREFERENCE_KEY = "custom-themes";

/** Bump when the stored `CustomThemesData` shape changes incompatibly. */
export const CUSTOM_THEMES_VERSION = 1;

/** Owner a published custom theme belongs to. */
export type CustomThemeScope = "user" | "shelf";

/**
 * Stored payload for the `custom-themes` key.
 *
 * `themes` is the full set of themes published under the owner. `active`
 * is the owner's chosen theme (used by shelves so visitors inherit the
 * shelf theme); `null` means no theme was explicitly pinned.
 */
export const CustomThemesDataSchema = z.object({
  version: z.number().int().nonnegative(),
  themes: z.array(z.unknown()),
  active: ThemePreferenceSchema.nullable().optional(),
});

export interface CustomThemesData {
  version: number;
  themes: GeneratedThemeRecord[];
  active: ThemePreference | null;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Parse a stored `custom-themes` payload defensively.
 *
 * The API transports `preferences_json` as a JSON-encoded string, but an
 * already-parsed object is accepted too. Individual theme records that do
 * not look like generated themes are dropped rather than failing the whole
 * blob. Returns `null` when the payload is absent or not an object with a
 * valid `version`.
 */
export function parseCustomThemesData(
  value: unknown,
): CustomThemesData | null {
  const raw = typeof value === "string" ? safeJsonParse(value) : value;
  const result = CustomThemesDataSchema.safeParse(raw);
  if (!result.success) {
    return null;
  }
  const themes = result.data.themes
    .filter(isGeneratedThemeRecord)
    .map(normalizeGeneratedThemeRecord);
  return {
    version: result.data.version,
    themes,
    active: result.data.active ?? null,
  };
}

/** Build the payload written to the `custom-themes` preferences row. */
export function buildCustomThemesData(
  themes: GeneratedThemeRecord[],
  active: ThemePreference | null = null,
): CustomThemesData {
  return { version: CUSTOM_THEMES_VERSION, themes, active };
}

/** Encode a `custom-themes` payload for the API's `preferences_json`. */
export function serializeCustomThemesData(data: CustomThemesData): string {
  return JSON.stringify(data);
}
