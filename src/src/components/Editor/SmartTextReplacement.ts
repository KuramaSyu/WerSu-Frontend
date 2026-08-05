// ProseMirror extension that rewrites common ASCII sequences into typographic
// glyphs as the user types. Inspired by Markdown smartypants rules.
//
// Today this only handles a handful of patterns that are unambiguous and
// safe to substitute: `--` -> en-dash, `->` -> right arrow, `=>` -> double
// right arrow. Each rule is keyed on the last few characters of the text
// that would appear immediately before the caret if the default text
// insertion went through.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

interface SmartReplacementRule {
  /** ASCII sequence that triggers the substitution. */
  pattern: string;
  /** Glyph to insert in place of `pattern`. */
  replacement: string;
}

/**
 * Rules are tried in declaration order. Each rule is matched against the
 * tail of the would-be-inserted text; longer patterns win naturally because
 * they only fire when the shorter patterns would also have matched.
 */
const smartReplacementRules: SmartReplacementRule[] = [
  { pattern: "--", replacement: "–" },
  { pattern: "->", replacement: "→" },
  { pattern: "=>", replacement: "⇒" },
];

const smartTextReplacementPluginKey = new PluginKey("smartTextReplacement");

// Exported so tests can identify this plugin via reference equality
// against `editor.state.plugins[*].spec.key`. The constructor name
// passed above is not exposed as a property on the resulting
// `PluginKey`, so identity is the only reliable way to look it up.
export { smartTextReplacementPluginKey };

/**
 * @returns how many characters immediately before the insertion point we
 * need to read so that, after appending the inserted text, every rule's
 * pattern can be checked at the tail of the resulting string.
 */
const maxRuleLength = (): number =>
  smartReplacementRules.reduce(
    (max, rule) => Math.max(max, rule.pattern.length),
    0,
  );

export const SmartTextReplacement = Extension.create({
  name: "smartTextReplacement",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: smartTextReplacementPluginKey,
        props: {
          /**
           * Called by ProseMirror's input rules machinery *before* the
           * text is inserted. Returning false lets the default insertion
           * happen; returning true tells ProseMirror we handled it.
           *
           * We look at the last `maxRuleLength` characters of the
           * existing document immediately before `from`, append the
           * incoming `text`, and check whether the result ends with any
           * rule pattern. If it does, we replace the matched tail with
           * the rule's glyph in a single transaction.
           */
          handleTextInput(view, from, to, text) {
            const windowSize = maxRuleLength();
            const textBefore = view.state.doc.textBetween(
              Math.max(0, from - windowSize),
              from,
              "\n",
              "\n",
            );
            const combined = textBefore + text;

            for (const rule of smartReplacementRules) {
              if (!combined.endsWith(rule.pattern)) {
                continue;
              }

              // The pattern may straddle the boundary between the
              // existing document and the incoming `text`. Split it
              // into the chars we need to delete from the doc and the
              // chars we need to drop from `text`.
              const charsInText = Math.min(rule.pattern.length, text.length);
              const charsInDoc = rule.pattern.length - charsInText;

              // Replace `[from - charsInDoc, to]` with the kept prefix
              // of `text` followed by the glyph. insertText also places
              // the caret at the end of the inserted text, which is
              // where the user expects to be after the auto-replace.
              const keptText = text.slice(0, text.length - charsInText);
              const tr = view.state.tr.insertText(
                keptText + rule.replacement,
                from - charsInDoc,
                to,
              );
              view.dispatch(tr);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
