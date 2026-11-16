/**
 * Wire + domain types for the spell-check preference.
 *
 * Spell check is configured per note and per user. The value is not a
 * dedicated backend resource: it is stored as a keyed
 * `/api/preferences` blob under `spellcheck@note:<noteId>`, which is
 * what `SpellcheckWithPreferencesApi` implements.
 */

export type SpellcheckLanguage = "de" | "en";

/**
 * Bump when the stored blob shape changes incompatibly so readers can
 * fall back to defaults instead of trusting an old payload.
 */
export const SPELLCHECK_PREFERENCE_VERSION = 1;

export interface SpellcheckPreference {
  version: number;
  enabled: boolean;
  language: SpellcheckLanguage;
}

/** A note without a stored row starts switched off. */
export const DEFAULT_SPELLCHECK_PREFERENCE: SpellcheckPreference = {
  version: SPELLCHECK_PREFERENCE_VERSION,
  enabled: false,
  language: "en",
};

/** Preference row key for one note. */
export function spellcheckPreferenceKey(noteId: string): string {
  return `spellcheck@note:${noteId}`;
}

function isLanguage(value: unknown): value is SpellcheckLanguage {
  return value === "de" || value === "en";
}

/**
 * Decode a stored blob defensively. Anything unreadable falls back to
 * `null` (the caller uses the default) rather than throwing in the
 * editor.
 */
export function parseSpellcheckPreference(
  value: unknown,
): SpellcheckPreference | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  // The backend echoes `{}` for a row that was never written.
  if (!("enabled" in record) && !("language" in record)) return null;
  return {
    version:
      typeof record.version === "number"
        ? record.version
        : SPELLCHECK_PREFERENCE_VERSION,
    enabled: record.enabled === true,
    language: isLanguage(record.language)
      ? record.language
      : DEFAULT_SPELLCHECK_PREFERENCE.language,
  };
}

// -----------------------------------------------------------------------------
// Endpoint request/reply shapes
// -----------------------------------------------------------------------------

/** Identifies the note whose preference is addressed. */
export interface SpellcheckPreferenceTarget {
  /** Owner of the preference row. */
  userId: string;
  noteId: string;
}

export type GetSpellcheckPreferenceRequest = SpellcheckPreferenceTarget;

/** Resolved preference; defaults are applied when no row exists. */
export type GetSpellcheckPreferenceReply = SpellcheckPreference;

export interface SetSpellcheckPreferenceRequest
  extends SpellcheckPreferenceTarget {
  preference: SpellcheckPreference;
}

/** The value that was written. */
export type SetSpellcheckPreferenceReply = SpellcheckPreference;

export type DeleteSpellcheckPreferenceRequest = SpellcheckPreferenceTarget;

export interface DeleteSpellcheckPreferenceReply {
  /** `true` iff a stored row was actually removed. */
  success: boolean;
}