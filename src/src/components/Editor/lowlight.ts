import { all, createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
// Default hljs themes. `CodeBlockThemer` no longer colors the
// `.hljs-*` classes with the MUI palette; these CSS files provide
// the per-token colors instead.
import "highlight.js/styles/atom-one-light.css";
import "highlight.js/styles/atom-one-dark.css";

/**
 * lowlight grammar set for the note editor.
 *
 * Curated subset (the 10 imports above) is used directly for the
 * languages users pick most often. The full `lowlight.all` set
 * (380+ grammars) is registered on top so any language the user
 * selects from the picker gets a real lexer instead of falling
 * through to `plaintext`.
 *
 * `defaultLanguage: "plaintext"` is pinned on `CustomCodeBlock` at
 * the call sites — that keeps the
 * `@tiptap/extension-code-block-lowlight` dispatch on
 * `lowlight.highlight(language, ...)` for blocks without an explicit
 * `language` attr, so the costly `highlightAuto` path stays
 * unreachable. See `scripts/lowlight-bench.mjs` for the cost numbers.
 *
 * Token colors come from the hljs CSS themes imported above;
 * `CodeBlockThemer` only paints the code-block wrapper (background,
 * border, font) and leaves the `.hljs-*` selectors to the imported
 * stylesheets.
 */
export const lowlight = createLowlight();

lowlight.register("bash", bash);
lowlight.register("css", css);
lowlight.register("javascript", javascript);
lowlight.register("json", json);
lowlight.register("markdown", markdown);
lowlight.register("plaintext", plaintext);
lowlight.register("python", python);
lowlight.register("sql", sql);
lowlight.register("typescript", typescript);
lowlight.register("xml", xml);

for (const [name, grammar] of Object.entries(all)) {
  if (!lowlight.registered(name)) lowlight.register(name, grammar);
}

export const SUPPORTED_LANGUAGES: readonly string[] = Object.freeze([
  "plaintext",
  ...lowlight
    .listLanguages()
    .filter((l) => l !== "plaintext")
    .sort(),
]);
