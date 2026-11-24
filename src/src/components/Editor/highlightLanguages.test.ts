import { describe, expect, it } from "vitest";
import { createLowlight } from "lowlight";
import { HIGHLIGHT_LANGUAGE_NAMES } from "./highlightLanguages";
import { registerAllGrammars } from "./lowlightGrammars";

// The pickers build `SUPPORTED_LANGUAGES` from a static name snapshot so
// they can render before the highlight.js grammar chunk arrives. That is
// only safe while the snapshot matches what `lowlight.all` actually
// provides — guard it here (and fail on a highlight.js bump that adds or
// drops a grammar) instead of silently losing languages at runtime.
describe("HIGHLIGHT_LANGUAGE_NAMES", () => {
  it("matches every grammar registered by lowlight.all", () => {
    const lowlight = createLowlight();
    registerAllGrammars(lowlight);

    expect([...HIGHLIGHT_LANGUAGE_NAMES].sort()).toEqual(
      lowlight.listLanguages().sort(),
    );
  });
});
