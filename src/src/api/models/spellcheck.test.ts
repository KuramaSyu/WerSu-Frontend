import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPELLCHECK_PREFERENCE,
  parseSpellcheckPreference,
  spellcheckPreferenceKey,
} from "./spellcheck";

describe("spellcheckPreferenceKey", () => {
  it("scopes the row to the note id", () => {
    expect(spellcheckPreferenceKey("note-1")).toBe("spellcheck@note:note-1");
  });
});

describe("parseSpellcheckPreference", () => {
  it("reads a stored row", () => {
    expect(
      parseSpellcheckPreference(
        JSON.stringify({ version: 1, enabled: true, language: "de" }),
      ),
    ).toEqual({ version: 1, enabled: true, language: "de" });
  });

  it("returns null for an absent or unreadable row", () => {
    expect(parseSpellcheckPreference("")).toBeNull();
    expect(parseSpellcheckPreference("{}")).toBeNull();
    expect(parseSpellcheckPreference("not json")).toBeNull();
  });

  it("falls back to the default language for unknown codes", () => {
    expect(
      parseSpellcheckPreference(
        JSON.stringify({ version: 1, enabled: true, language: "fr" }),
      ),
    ).toEqual({
      version: 1,
      enabled: true,
      language: DEFAULT_SPELLCHECK_PREFERENCE.language,
    });
  });

  it("treats a missing enabled flag as off", () => {
    expect(
      parseSpellcheckPreference(JSON.stringify({ language: "de" })),
    ).toEqual({
      version: 1,
      enabled: false,
      language: "de",
    });
  });
});