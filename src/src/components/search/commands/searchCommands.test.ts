import { describe, expect, it } from "vitest";
import { RestNotesSearchType } from "../../../api/models/search";
import {
  findSearchCommand,
  findSearchModeOption,
  getSearchCommandSuggestions,
  resolveSearchCommand,
} from "./searchCommands";

describe("getSearchCommandSuggestions", () => {
  it("returns nothing for a plain query", () => {
    expect(getSearchCommandSuggestions("")).toEqual([]);
    expect(getSearchCommandSuggestions("notes about rust")).toEqual([]);
  });

  it("lists every command for a bare slash", () => {
    const suggestions = getSearchCommandSuggestions("/");
    const labels = suggestions.map((s) => s.label);
    expect(labels).toEqual([
      "/mode",
      "/context",
      "/keyword",
      "/fuzzy",
      "/clear",
    ]);
  });

  it("ranks prefix matches first", () => {
    const suggestions = getSearchCommandSuggestions("/co");
    expect(suggestions[0].label).toBe("/context");
    expect(suggestions[0].searchType).toBe(RestNotesSearchType.CONTEXT);
  });

  it("matches command aliases", () => {
    const suggestions = getSearchCommandSuggestions("/ctx");
    expect(suggestions[0].commandId).toBe("context");
  });

  it("exposes the clear command", () => {
    const [clear] = getSearchCommandSuggestions("/cle");
    expect(clear.commandId).toBe("clear");
    expect(clear.action).toBe("clear");
  });

  it("marks the bare mode command as completion-only", () => {
    const [mode] = getSearchCommandSuggestions("/mode");
    expect(mode.completesOnly).toBe(true);
    expect(mode.completion).toBe("/mode ");
    expect(mode.searchType).toBeUndefined();
  });

  it("suggests every mode once an argument is expected", () => {
    const suggestions = getSearchCommandSuggestions("/mode ");
    expect(suggestions.map((s) => s.argValue)).toEqual([
      "keyword",
      "fuzzy",
      "context",
    ]);
    expect(suggestions[2].searchType).toBe(RestNotesSearchType.CONTEXT);
    expect(suggestions[2].completion).toBe("/mode context");
  });

  it("filters mode arguments by prefix", () => {
    const suggestions = getSearchCommandSuggestions("/mode co");
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].argValue).toBe("context");
  });

  it("accepts mode argument aliases", () => {
    const suggestions = getSearchCommandSuggestions("/mode typo");
    expect(suggestions[0].argValue).toBe("fuzzy");
    expect(getSearchCommandSuggestions("/similar")[0].commandId).toBe(
      "fuzzy",
    );
  });

  it("returns nothing for a direct command followed by text", () => {
    expect(getSearchCommandSuggestions("/context foo")).toEqual([]);
  });
});

describe("resolveSearchCommand", () => {
  it("ignores non-command input", () => {
    expect(resolveSearchCommand("plain query")).toBeNull();
    expect(resolveSearchCommand("")).toBeNull();
  });

  it("resolves direct mode commands", () => {
    expect(resolveSearchCommand("/context")?.searchType).toBe(
      RestNotesSearchType.CONTEXT,
    );
    expect(resolveSearchCommand("/keyword")?.searchType).toBe(
      RestNotesSearchType.KEYWORD,
    );
    expect(resolveSearchCommand("/fuzzy")?.searchType).toBe(
      RestNotesSearchType.TYPO_TOLERANT,
    );
  });

  it("resolves /clear to the clear action", () => {
    expect(resolveSearchCommand("/clear")).toEqual({
      commandId: "clear",
      label: "/clear",
      action: "clear",
    });
    expect(resolveSearchCommand("/reset")?.action).toBe("clear");
    expect(resolveSearchCommand("/x")?.action).toBe("clear");
  });

  it("resolves direct commands via aliases", () => {
    expect(resolveSearchCommand("/ctx")?.searchType).toBe(
      RestNotesSearchType.CONTEXT,
    );
    expect(resolveSearchCommand("/similarity")?.searchType).toBe(
      RestNotesSearchType.TYPO_TOLERANT,
    );
    expect(resolveSearchCommand("/similar")?.searchType).toBe(
      RestNotesSearchType.TYPO_TOLERANT,
    );
  });

  it("resolves /mode with a valid argument", () => {
    expect(resolveSearchCommand("/mode context")?.searchType).toBe(
      RestNotesSearchType.CONTEXT,
    );
    expect(resolveSearchCommand("/mode typo")?.searchType).toBe(
      RestNotesSearchType.TYPO_TOLERANT,
    );
    expect(resolveSearchCommand("/mode similarity")?.searchType).toBe(
      RestNotesSearchType.TYPO_TOLERANT,
    );
  });

  it("ignores trailing text after a direct command", () => {
    expect(resolveSearchCommand("/context some query")?.searchType).toBe(
      RestNotesSearchType.CONTEXT,
    );
  });

  it("rejects incomplete or unknown commands", () => {
    expect(resolveSearchCommand("/mode")).toBeNull();
    expect(resolveSearchCommand("/mode nonsense")).toBeNull();
    expect(resolveSearchCommand("/mode two words")).toBeNull();
    expect(resolveSearchCommand("/unknown")).toBeNull();
    expect(resolveSearchCommand("/contextual")).toBeNull();
  });
});

describe("lookups", () => {
  it("finds commands by name and alias", () => {
    expect(findSearchCommand("mode")?.id).toBe("mode");
    expect(findSearchCommand("m")?.id).toBe("mode");
    expect(findSearchCommand("ctx")?.id).toBe("context");
    expect(findSearchCommand("nope")).toBeUndefined();
  });

  it("finds mode options by value and alias", () => {
    expect(findSearchModeOption("typo")?.value).toBe("fuzzy");
    expect(findSearchModeOption("similarity")?.value).toBe("fuzzy");
    expect(findSearchModeOption("semantic")?.value).toBe("context");
    expect(findSearchModeOption("nope")).toBeUndefined();
  });
});
