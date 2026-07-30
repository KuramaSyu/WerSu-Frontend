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
// CSS for hljs themes is fetched at runtime by `loadCodeBlockTheme` and
// injected into a scoped <style data-cb-theme="..."> tag, so the
// selectors only paint tokens inside the editor wrapper.
import { type CodeBlockTheme } from "../../zustand/useAppearanceSettings";
import tokyoNightDark from "highlight.js/styles/tokyo-night-dark.css?raw";
import tokyoNightLight from "highlight.js/styles/tokyo-night-light.css?raw";
import atomOneDark from "highlight.js/styles/atom-one-dark.css?raw";
import atomOneLight from "highlight.js/styles/atom-one-light.css?raw";
import gruvboxDarkPale from "highlight.js/styles/base16/gruvbox-dark-pale.css?raw";
import gruvboxLightHard from "highlight.js/styles/base16/gruvbox-light-hard.css?raw";
import materialPalenight from "highlight.js/styles/base16/material-palenight.css?raw";

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
 * the call sites - that keeps the
 * `@tiptap/extension-code-block-lowlight` dispatch on
 * `lowlight.highlight(language, ...)` for blocks without an explicit
 * `language` attr, so the costly `highlightAuto` path stays
 * unreachable. See `scripts/lowlight-bench.mjs` for the cost numbers.
 *
 * Token colors come from a user-selectable hljs theme; see
 * `loadCodeBlockTheme` for the runtime CSS swap.
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

/**
 * Raw CSS strings for every bundled code-block theme.
 *
 * Loaded once via Vite's `?raw` import so theme swaps are an attribute
 * flip rather than a network round-trip. Keys are validated against
 * `CODE_BLOCK_THEMES` so a stale entry can't sneak past.
 */
const CODE_BLOCK_THEME_CSS: Record<CodeBlockTheme, string> = {
  "tokyo-night-dark": tokyoNightDark,
  "tokyo-night-light": tokyoNightLight,
  "atom-one-dark": atomOneDark,
  "atom-one-light": atomOneLight,
  "gruvbox-dark-pale": gruvboxDarkPale,
  "gruvbox-light-hard": gruvboxLightHard,
  "material-palenight": materialPalenight,
};

/**
 * Inject the chosen theme's CSS into a scoped <style> tag.
 *
 * Bundled hljs themes define unscoped `.hljs-*` selectors; we wrap
 * each rule under `[data-cb-theme="..."]` so two themes can never
 * collide and the rule never leaks outside the editor wrapper.
 */
export const loadCodeBlockTheme = (theme: CodeBlockTheme): void => {
  if (typeof document === "undefined") return;
  const css = CODE_BLOCK_THEME_CSS[theme];
  const styleId = `cb-theme-${theme}`;
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (styleEl === null) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.dataset.cbTheme = theme;
    styleEl.textContent = scopeThemeCss(css, theme);
    document.head.appendChild(styleEl);
  }
  document.documentElement.dataset.cbActiveTheme = theme;
};

/**
 * Prefix every `.hljs-*` selector in `css` with `[data-cb-theme="..."]`.
 *
 * Bundled hljs themes only use class selectors (no at-rules we care
 * about), so a regex over each rule head is enough.
 */
const scopeThemeCss = (css: string, theme: CodeBlockTheme): string => {
  const attr = `[data-cb-theme="${theme}"]`;
  return css.replace(/([^{}]+)\{/g, (_match, selectors: string) => {
    const prefixed = selectors
      .split(",")
      .map((sel) => `${attr} ${sel.trim()}`)
      .join(", ");
    return `${prefixed}{`;
  });
};
