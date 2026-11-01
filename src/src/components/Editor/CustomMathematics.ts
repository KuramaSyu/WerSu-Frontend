import { Extension } from "@tiptap/core";
import {
  BlockMath,
  InlineMath,
  type MathematicsOptions,
} from "@tiptap/extension-mathematics";

// ---------------------------------------------------------------------------
// CustomMathematics
//
// Drop-in replacement for `@tiptap/extension-mathematics`.
//
// Why this exists:
// The upstream markdown tokenizers only accept `$$...$$` as *block* math when
// it starts a standalone top-level block. LLM-generated notes often place
// `$$...$$` mid-paragraph (e.g. after a `<br/>` or inside a list item). The
// block tokenizer never fires there, so the stray `$` characters get mispaired
// with the single-`$` inline tokenizer and swallow the surrounding text
// (e.g. `*Beispiel:*` becomes math content).
//
// A true `blockMath` node cannot live after an inline hard break inside the
// same paragraph, so we instead extend the *inline* tokenizer to also accept
// `$$...$$`. That latex is prefixed with `\displaystyle`, which gives the same
// large/display rendering as block math while remaining inline (and therefore
// valid inside paragraphs and list items).
//
// Top-level standalone `$$...$$` is still parsed by the untouched BlockMath
// tokenizer, so existing block math keeps working.
// ---------------------------------------------------------------------------

const DisplayInlineMath = InlineMath.extend({
  markdownTokenizer: {
    name: "inlineMath",
    level: "inline",
    start: (src: string) => src.indexOf("$"),
    tokenize: (src: string) => {
      // `$$...$$` -> display-style inline math (works anywhere inline).
      const display = src.match(/^\$\$([^$]+)\$\$/);
      if (display) {
        return {
          type: "inlineMath",
          raw: display[0],
          latex: `\\displaystyle ${display[1].trim()}`,
        };
      }

      // Regular `$...$` inline math.
      const inline = src.match(/^\$([^$]+)\$(?!\$)/);
      if (inline) {
        return {
          type: "inlineMath",
          raw: inline[0],
          latex: inline[1].trim(),
        };
      }

      return undefined;
    },
  },
});

export const CustomMathematics = Extension.create<MathematicsOptions>({
  name: "Mathematics",
  addOptions() {
    return {
      inlineOptions: undefined,
      blockOptions: undefined,
      katexOptions: undefined,
    };
  },
  addExtensions() {
    return [
      BlockMath.configure({
        ...this.options.blockOptions,
        katexOptions: this.options.katexOptions,
      }),
      DisplayInlineMath.configure({
        ...this.options.inlineOptions,
        katexOptions: this.options.katexOptions,
      }),
    ];
  },
});
