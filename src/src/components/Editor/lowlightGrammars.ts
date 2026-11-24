// All 380+ highlight.js grammars, behind a dynamic import.
//
// This is the 900 kB+ half of `lowlight`: only fetched when the editor
// chunk starts up (and cached thereafter), never as part of the initial
// page load. `lowlight.ts` imports this file lazily and registers the
// result on the shared `lowlight` instance; the synchronous language
// list the pickers need lives in `highlightLanguages.ts`.
import { all } from "lowlight";
import type { createLowlight } from "lowlight";

type Lowlight = ReturnType<typeof createLowlight>;

/** Registers every grammar that is not registered yet. */
export const registerAllGrammars = (lowlight: Lowlight): void => {
  for (const [name, grammar] of Object.entries(all)) {
    if (!lowlight.registered(name)) {
      lowlight.register(name, grammar as never);
    }
  }
};
