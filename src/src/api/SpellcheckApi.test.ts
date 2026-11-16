import { describe, expect, it, vi } from "vitest";
import {
  SpellcheckWithPreferencesApi,
  createSpellcheckApi,
} from "./SpellcheckApi";
import type { PreferencesApi } from "./PreferencesApi";
import { DEFAULT_SPELLCHECK_PREFERENCE } from "./models/spellcheck";
import type {
  MergePreferencesEndpointRequest,
  ReplacePreferencesEndpointRequest,
} from "./models/preferences";

const TARGET = {
  scope: "user" as const,
  target_id: "user-1",
  key: "spellcheck@note:note-1",
};

/** In-memory stand-in for the real preference REST client. */
class StubPreferencesApi implements PreferencesApi {
  stored = "{}";

  private reply() {
    return { ...TARGET, preferences_json: this.stored };
  }

  getPreferences = vi.fn(async () => this.reply());

  replacePreferences = vi.fn(async (request: ReplacePreferencesEndpointRequest) => {
    this.stored = request.preferences_json;
    return this.reply();
  });

  mergePreferences = vi.fn(async (request: MergePreferencesEndpointRequest) => {
    this.stored = JSON.stringify({
      ...(JSON.parse(this.stored) as Record<string, unknown>),
      ...(JSON.parse(request.preferences_json) as Record<string, unknown>),
    });
    return this.reply();
  });

  deletePreferences = vi.fn(async () => ({ success: true }));
}

describe("SpellcheckWithPreferencesApi", () => {
  it("returns the default when no row is stored", async () => {
    const api = new SpellcheckWithPreferencesApi(new StubPreferencesApi());
    await expect(
      api.getSpellcheckPreference({ userId: "user-1", noteId: "note-1" }),
    ).resolves.toEqual(DEFAULT_SPELLCHECK_PREFERENCE);
  });

  it("reads the note's keyed row", async () => {
    const preferences = new StubPreferencesApi();
    preferences.stored = JSON.stringify({
      version: 1,
      enabled: true,
      language: "de",
    });
    const api = new SpellcheckWithPreferencesApi(preferences);

    await expect(
      api.getSpellcheckPreference({ userId: "user-1", noteId: "note-1" }),
    ).resolves.toEqual({ version: 1, enabled: true, language: "de" });
    expect(preferences.getPreferences).toHaveBeenCalledWith(TARGET);
  });

  it("writes a PATCH merge under the note's key", async () => {
    const preferences = new StubPreferencesApi();
    const api = createSpellcheckApi(preferences);

    const saved = await api.setSpellcheckPreference({
      userId: "user-1",
      noteId: "note-1",
      preference: { version: 1, enabled: true, language: "de" },
    });

    expect(saved).toEqual({ version: 1, enabled: true, language: "de" });
    expect(preferences.mergePreferences).toHaveBeenCalledWith({
      ...TARGET,
      preferences_json: JSON.stringify({
        version: 1,
        enabled: true,
        language: "de",
      }),
    });
    expect(preferences.replacePreferences).not.toHaveBeenCalled();
  });

  it("deletes the note's row", async () => {
    const preferences = new StubPreferencesApi();
    const api = new SpellcheckWithPreferencesApi(preferences);

    await expect(
      api.deleteSpellcheckPreference({ userId: "user-1", noteId: "note-1" }),
    ).resolves.toEqual({ success: true });
    expect(preferences.deletePreferences).toHaveBeenCalledWith(TARGET);
  });
});