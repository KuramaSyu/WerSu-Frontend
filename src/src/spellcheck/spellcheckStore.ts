// Runtime state for the per-note spell checker.
//
// One store serves whichever editor is mounted: the controller sets
// the active note's setting, the ProseMirror plugin reads it, and the
// right-click menu asks it for suggestions. Dictionaries load lazily
// the first time a note enables the feature.

import { create } from "zustand";
import {
  getCachedSpellChecker,
  loadSpellChecker,
  type SpellChecker,
  type SpellcheckLanguage,
} from "./dictionary";

export interface SpellcheckConfig {
  enabled: boolean;
  language: SpellcheckLanguage | null;
}

type SpellcheckStatus = "idle" | "loading" | "ready" | "error";

export interface SpellcheckState extends SpellcheckConfig {
  checker: SpellChecker | null;
  status: SpellcheckStatus;
  error: string | null;
  /**
   * Bumped whenever decorations must be rebuilt. The plugin compares
   * it across store updates instead of diffing the config itself.
   */
  version: number;
  /** Apply a note's setting; loads the dictionary when it turns on. */
  configure: (config: SpellcheckConfig) => void;
  /** Turn everything off and clear the checker (on unmount). */
  reset: () => void;
  /** Suggestions for a misspelled word, empty while loading. */
  getSuggestions: (word: string, limit?: number) => string[];
}

/** Guards against a slow load finishing after a different note won. */
let loadToken = 0;

export const useSpellcheckStore = create<SpellcheckState>((set, get) => ({
  enabled: false,
  language: null,
  checker: null,
  status: "idle",
  error: null,
  version: 0,

  configure: (config) => {
    const language = config.language;
    const enabled = config.enabled && language !== null;
    const state = get();
    if (state.enabled === enabled && state.language === language) return;

    const token = ++loadToken;

    if (!enabled || language === null) {
      set({
        enabled: false,
        language,
        checker: null,
        status: "idle",
        error: null,
        version: state.version + 1,
      });
      return;
    }

    // A language already in memory applies immediately; the promise
    // below still resolves synchronously enough to bump the version.
    set({
      enabled: true,
      language,
      checker: getCachedSpellChecker(language),
      status: getCachedSpellChecker(language) ? "ready" : "loading",
      error: null,
      version: state.version + 1,
    });

    void loadSpellChecker(language).then(
      (checker) => {
        if (token !== loadToken) return;
        set({ checker, status: "ready", version: get().version + 1 });
      },
      (error: unknown) => {
        if (token !== loadToken) return;
        set({
          checker: null,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
          version: get().version + 1,
        });
      },
    );
  },

  reset: () => {
    loadToken += 1;
    set({
      enabled: false,
      language: null,
      checker: null,
      status: "idle",
      error: null,
      version: get().version + 1,
    });
  },

  getSuggestions: (word, limit = 5) => {
    const { checker } = get();
    if (!checker) return [];
    return checker.suggest(word, limit);
  },
}));