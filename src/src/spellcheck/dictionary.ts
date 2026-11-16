// Lazy dictionary loading for the in-app spell checker.
//
// The Hunspell word lists live under ./dictionaries and are imported
// with Vite's ?raw loader. Both the nspell engine and the word list
// only reach the browser after the user enables spell check on a
// note, so a user who never opts in downloads none of this.

import type { SpellcheckLanguage } from "../api/models/spellcheck";
import type { NSpellInstance } from "nspell";

export type { SpellcheckLanguage } from "../api/models/spellcheck";

/** Language entries offered in the spell-check dialog. */
export const SPELLCHECK_LANGUAGES: readonly {
  value: SpellcheckLanguage;
  label: string;
}[] = [
  { value: "de", label: "German" },
  { value: "en", label: "English" },
];

export interface SpellChecker {
  /** True when the word is in the dictionary. */
  check(word: string): boolean;
  /** Spelling suggestions, best first. */
  suggest(word: string, limit?: number): string[];
}

interface RawDictionary {
  aff: string;
  dic: string;
}

const checkerCache = new Map<SpellcheckLanguage, Promise<SpellChecker>>();

async function loadRawDictionary(
  language: SpellcheckLanguage,
): Promise<RawDictionary> {
  if (language === "de") {
    const [aff, dic] = await Promise.all([
      import("./dictionaries/de.aff?raw"),
      import("./dictionaries/de.dic?raw"),
    ]);
    return { aff: aff.default, dic: dic.default };
  }
  const [aff, dic] = await Promise.all([
    import("./dictionaries/en.aff?raw"),
    import("./dictionaries/en.dic?raw"),
  ]);
  return { aff: aff.default, dic: dic.default };
}

function wrap(spell: NSpellInstance): SpellChecker {
  return {
    check: (word) => spell.correct(word),
    suggest: (word, limit = 5) => {
      try {
        return spell.suggest(word).slice(0, limit);
      } catch {
        // A malformed word must never break the editor.
        return [];
      }
    },
  };
}

/** Already-resolved checker for a language, or null while it loads. */
export function getCachedSpellChecker(
  language: SpellcheckLanguage,
): SpellChecker | null {
  const pending = checkerCache.get(language);
  if (!pending) return null;
  // Promise state is not inspectable; a resolved checker is recorded
  // separately below so callers can tell "loading" from "ready".
  return resolvedCheckers.get(language) ?? null;
}

const resolvedCheckers = new Map<SpellcheckLanguage, SpellChecker>();

/** Load (once per language) and cache the spell checker. */
export function loadSpellChecker(
  language: SpellcheckLanguage,
): Promise<SpellChecker> {
  const cached = checkerCache.get(language);
  if (cached) return cached;

  const pending = (async () => {
    const [{ default: NSpell }, dictionary] = await Promise.all([
      import("nspell"),
      loadRawDictionary(language),
    ]);
    const checker = wrap(NSpell(dictionary.aff, dictionary.dic));
    resolvedCheckers.set(language, checker);
    return checker;
  })();

  checkerCache.set(language, pending);
  pending.catch(() => {
    // Let a later attempt retry after a failed download.
    checkerCache.delete(language);
  });
  return pending;
}

/** Test seam: inject a fake checker so unit tests never load a dictionary. */
export function __setSpellCheckerForTests(
  language: SpellcheckLanguage,
  checker: SpellChecker | null,
): void {
  if (checker === null) {
    checkerCache.delete(language);
    resolvedCheckers.delete(language);
    return;
  }
  checkerCache.set(language, Promise.resolve(checker));
  resolvedCheckers.set(language, checker);
}