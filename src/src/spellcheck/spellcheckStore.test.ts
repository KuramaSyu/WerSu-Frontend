import { beforeEach, describe, expect, it } from "vitest";
import {
  __setSpellCheckerForTests,
  type SpellChecker,
} from "./dictionary";
import { useSpellcheckStore } from "./spellcheckStore";

const fakeChecker: SpellChecker = {
  check: (word) => word === "Welt",
  suggest: (word, limit = 5) => [`${word}-fix`, "Welt"].slice(0, limit),
};

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useSpellcheckStore", () => {
  beforeEach(() => {
    __setSpellCheckerForTests("en", fakeChecker);
    __setSpellCheckerForTests("de", fakeChecker);
    useSpellcheckStore.getState().reset();
  });

  it("stays idle until a note enables it", () => {
    const state = useSpellcheckStore.getState();
    expect(state.enabled).toBe(false);
    expect(state.status).toBe("idle");
    expect(state.getSuggestions("Wlet")).toEqual([]);
  });

  it("loads the dictionary when enabled", async () => {
    useSpellcheckStore
      .getState()
      .configure({ enabled: true, language: "en" });
    await flushPromises();

    const state = useSpellcheckStore.getState();
    expect(state.status).toBe("ready");
    expect(state.checker).toBe(fakeChecker);
    expect(state.getSuggestions("Wlet", 5)).toEqual(["Wlet-fix", "Welt"]);
  });

  it("clears the checker when disabled", async () => {
    useSpellcheckStore
      .getState()
      .configure({ enabled: true, language: "de" });
    await flushPromises();
    const version = useSpellcheckStore.getState().version;

    useSpellcheckStore
      .getState()
      .configure({ enabled: false, language: "de" });

    const state = useSpellcheckStore.getState();
    expect(state.enabled).toBe(false);
    expect(state.checker).toBeNull();
    expect(state.status).toBe("idle");
    expect(state.version).toBe(version + 1);
  });

  it("bumps the version so decorations rebuild", async () => {
    const before = useSpellcheckStore.getState().version;
    useSpellcheckStore
      .getState()
      .configure({ enabled: true, language: "en" });
    await flushPromises();
    expect(useSpellcheckStore.getState().version).toBeGreaterThan(before + 1);
  });

  it("ignores a language equal to the current one", async () => {
    useSpellcheckStore
      .getState()
      .configure({ enabled: true, language: "en" });
    await flushPromises();
    const version = useSpellcheckStore.getState().version;

    useSpellcheckStore
      .getState()
      .configure({ enabled: true, language: "en" });
    expect(useSpellcheckStore.getState().version).toBe(version);
  });
});