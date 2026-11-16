/*
  Spell-check preference API.

  Spell check has no dedicated backend endpoint. The preference is a
  keyed `/api/preferences` blob, so the default implementation
  (`SpellcheckWithPreferencesApi`) composes the `PreferencesApi` and
  hides the key format from callers.

  The interface split follows `PreferencesApi` / `ShelfApi`: tests can
  register an in-memory implementation in `apiRegistry` under
  `SPELLCHECK_API_TOKEN` without touching query hooks or components.

  Wire types live in `./models/spellcheck`; TanStack hooks in
  `./queries/spellcheckQueries`.
*/

import {
  DEFAULT_SPELLCHECK_PREFERENCE,
  parseSpellcheckPreference,
  SPELLCHECK_PREFERENCE_VERSION,
  spellcheckPreferenceKey,
} from "./models/spellcheck";
import type {
  DeleteSpellcheckPreferenceReply,
  DeleteSpellcheckPreferenceRequest,
  GetSpellcheckPreferenceReply,
  GetSpellcheckPreferenceRequest,
  SetSpellcheckPreferenceReply,
  SetSpellcheckPreferenceRequest,
} from "./models/spellcheck";
import { getPreferencesApi, type PreferencesApi } from "./PreferencesApi";
import { apiRegistry, type ApiToken } from "./apiRegistry";

/**
 * Read/write surface for the per-note spell-check setting.
 *
 * Every operation is scoped to one `(userId, noteId)` pair. A missing
 * stored row resolves to `DEFAULT_SPELLCHECK_PREFERENCE` (off), never
 * to an error.
 */
export interface SpellcheckApi {
  /** Stored preference for the note, or the default when absent. */
  getSpellcheckPreference(
    request: GetSpellcheckPreferenceRequest,
  ): Promise<GetSpellcheckPreferenceReply>;

  /** Persist the preference for the note and echo it back. */
  setSpellcheckPreference(
    request: SetSpellcheckPreferenceRequest,
  ): Promise<SetSpellcheckPreferenceReply>;

  /** Drop the stored row. Idempotent. */
  deleteSpellcheckPreference(
    request: DeleteSpellcheckPreferenceRequest,
  ): Promise<DeleteSpellcheckPreferenceReply>;
}

/**
 * Abstract base so an alternative implementation can be registered
 * without changing the public type.
 */
export abstract class AbstractSpellcheckApi implements SpellcheckApi {
  abstract getSpellcheckPreference(
    request: GetSpellcheckPreferenceRequest,
  ): Promise<GetSpellcheckPreferenceReply>;
  abstract setSpellcheckPreference(
    request: SetSpellcheckPreferenceRequest,
  ): Promise<SetSpellcheckPreferenceReply>;
  abstract deleteSpellcheckPreference(
    request: DeleteSpellcheckPreferenceRequest,
  ): Promise<DeleteSpellcheckPreferenceReply>;
}

/**
 * Default implementation: one keyed preference row per note.
 *
 *   scope:     "user"
 *   target_id: the signed-in user's id
 *   key:       `spellcheck@note:<noteId>`
 *
 * Writes go through `mergePreferences` (PATCH) so a future field on the
 * same row survives a settings change.
 */
export class SpellcheckWithPreferencesApi extends AbstractSpellcheckApi {
  constructor(private readonly preferences: PreferencesApi) {
    super();
  }

  async getSpellcheckPreference(
    request: GetSpellcheckPreferenceRequest,
  ): Promise<GetSpellcheckPreferenceReply> {
    const reply = await this.preferences.getPreferences({
      scope: "user",
      target_id: request.userId,
      key: spellcheckPreferenceKey(request.noteId),
    });
    return (
      parseSpellcheckPreference(reply?.preferences_json) ??
      DEFAULT_SPELLCHECK_PREFERENCE
    );
  }

  async setSpellcheckPreference(
    request: SetSpellcheckPreferenceRequest,
  ): Promise<SetSpellcheckPreferenceReply> {
    const preference = {
      ...request.preference,
      version: SPELLCHECK_PREFERENCE_VERSION,
    };
    await this.preferences.mergePreferences({
      scope: "user",
      target_id: request.userId,
      key: spellcheckPreferenceKey(request.noteId),
      preferences_json: JSON.stringify(preference),
    });
    return preference;
  }

  async deleteSpellcheckPreference(
    request: DeleteSpellcheckPreferenceRequest,
  ): Promise<DeleteSpellcheckPreferenceReply> {
    const reply = await this.preferences.deletePreferences({
      scope: "user",
      target_id: request.userId,
      key: spellcheckPreferenceKey(request.noteId),
    });
    return { success: reply?.success === true };
  }
}

/** Build an implementation on top of any `PreferencesApi`. */
export function createSpellcheckApi(
  preferences: PreferencesApi,
): SpellcheckApi {
  return new SpellcheckWithPreferencesApi(preferences);
}

/** Shared singleton used by the query hooks. */
export const spellcheckApi: SpellcheckApi = createSpellcheckApi(
  getPreferencesApi(),
);

// Register the singleton under a typed token so tests and plugin code
// can swap it with `registerSpellcheckApi`.
export const SPELLCHECK_API_TOKEN: ApiToken<SpellcheckApi> = Symbol(
  "SpellcheckApi",
) as ApiToken<SpellcheckApi>;
apiRegistry.register(spellcheckApi, SPELLCHECK_API_TOKEN);

/** Install an alternative implementation (tests, fake mode). */
export function registerSpellcheckApi(api: SpellcheckApi): void {
  apiRegistry.register(api, SPELLCHECK_API_TOKEN);
}

/**
 * Resolve the registered `SpellcheckApi`.
 *
 * Throws when nothing is registered, so a missing wiring step surfaces
 * at the first read instead of silently disabling spell check.
 */
export function getSpellcheckApi(): SpellcheckApi {
  return apiRegistry.get<SpellcheckApi>(SPELLCHECK_API_TOKEN);
}