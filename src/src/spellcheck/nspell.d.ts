// Minimal ambient types for the parts of nspell this app uses.
// nspell ships as CommonJS without its own declarations; the
// community types exist but model the default export in a way that
// collides with `verbatimModuleSyntax`.

declare module "nspell" {
  export interface NSpellInstance {
    correct(word: string): boolean;
    suggest(word: string): string[];
  }

  export default function nspell(
    aff: string,
    dic: string,
  ): NSpellInstance;
}