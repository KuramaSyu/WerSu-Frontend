import { createLowlight } from "lowlight";
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

/**
 * Curated lowlight grammar set for the note editor.
 *
 * `import { all } from "lowlight"` registers 380+ languages and
 * `@tiptap/extension-code-block-lowlight` then walks all of them via
 * `highlightAuto` on every code block without an explicit `language`
 * attr. On real notes that froze the editor's transaction loop with
 * "Script terminated by timeout" (inherit$1 loader, then the lexer
 * itself).
 *
 * Registering only what we need makes `highlightAuto` walk ten
 * grammars instead of 380. `xml` aliases `html` so HTML works too.
 *
 * `plaintext` is also registered and pinned as `defaultLanguage` on
 * `CustomCodeBlock` at the call sites — that pins
 * `@tiptap/extension-code-block-lowlight`'s code path to
 * `lowlight.highlight(language, ...)` and makes
 * `lowlight.highlightAuto(...)` unreachable for plain code blocks.
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
