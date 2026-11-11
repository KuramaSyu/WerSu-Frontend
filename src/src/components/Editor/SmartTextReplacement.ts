// ProseMirror extension that rewrites common ASCII sequences into typographic
// glyphs as the user types. Inspired by Markdown smartypants rules.
//
// Today this only handles a handful of patterns that are unambiguous and
// safe to substitute: `--` -> en-dash, `->` -> right arrow, `=>` -> double
// right arrow. Each rule is keyed on the last few characters of the text
// that would appear immediately before the caret if the default text
// insertion went through.
//
// Two guard rails keep the substitution out of the user's way:
//   1. It is disabled inside code contexts (`codeBlock` nodes and the
//      inline `code` mark), where the literal ASCII sequence is almost
//      always what the author actually wants.
//   2. Pressing Backspace immediately after a substitution undoes it,
//      restoring the original ASCII sequence so it can be typed
//      literally. Typing the sequence again re-triggers the
//      substitution, so the rewrite is never a one-way trap.

import { Extension } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";

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

/** Records the most recent auto-substitution so Backspace can undo it.
 *
 *  `from` is the document position where the inserted glyph starts;
 *  `replacement` is the glyph that was inserted; `pattern` is the ASCII
 *  sequence it replaced. */
interface PendingSubstitution {
  from: number;
  replacement: string;
  pattern: string;
}

/**
 * Where the last substitution is remembered. It lives on the plugin's
 * `state` (not in a closure) so that *any* transaction that isn't our
 * substitution invalidates it — moving the caret, typing another
 * character, pasting, undo/redo, collaborative updates, etc. Without
 * this, a stale entry could undo a substitution long after the user
 * has moved on.
 */
interface SmartTextReplacementState {
  pending: PendingSubstitution | null;
}

const META_KEY = "smartTextReplacement:substitution";

const initialReplacementState: SmartTextReplacementState = { pending: null };

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

/**
 * True when text inserted at `pos` would land inside a code context —
 * a `codeBlock` node or text carrying the inline `code` mark. The
 * substitution rules are ASCII-to-typography conveniences, so they must
 * never fire there.
 *
 * The checks go through `state.schema` rather than `editor.isActive(...)`
 * because `isActive` throws when the editor was built without the named
 * node/mark (e.g. tests that disable `codeBlock`), while a schema lookup
 * simply returns `undefined`.
 */
const isCodeContext = (state: EditorState, pos: number): boolean => {
  const { doc, schema } = state;
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));

  if (schema.nodes.codeBlock) {
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type === schema.nodes.codeBlock) {
        return true;
      }
    }
  }

  if (schema.marks.code) {
    const carriesCodeMark = [...$pos.marks(), ...($pos.nodeAfter?.marks ?? [])];
    if (carriesCodeMark.some((mark) => mark.type === schema.marks.code)) {
      return true;
    }
  }

  return false;
};

/** Reads the pending substitution recorded by the reducer. */
const getPendingSubstitution = (
  state: EditorState,
): PendingSubstitution | null =>
  (
    smartTextReplacementPluginKey.getState(state) as
      SmartTextReplacementState | undefined
  )?.pending ?? null;

export const SmartTextReplacement = Extension.create({
  name: "smartTextReplacement",

  addProseMirrorPlugins() {
    return [
      new Plugin<SmartTextReplacementState>({
        key: smartTextReplacementPluginKey,

        state: {
          init: () => initialReplacementState,
          apply(tr: Transaction, value: SmartTextReplacementState) {
            // Our own substitution sets the next value via metadata; any
            // other document/selection change clears the pending undo.
            const meta = tr.getMeta(META_KEY) as
              PendingSubstitution | null | undefined;
            if (meta !== undefined) {
              return { pending: meta };
            }
            if (value.pending && (tr.docChanged || tr.selectionSet)) {
              return { pending: null };
            }
            return value;
          },
        },

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
            // Code is literal by default: keep `--`, `->`, and `=>`
            // exactly as typed inside code blocks and inline code.
            if (isCodeContext(view.state, from)) {
              return false;
            }

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
              const glyphFrom = from - charsInDoc + keptText.length;
              const tr = view.state.tr.insertText(
                keptText + rule.replacement,
                from - charsInDoc,
                to,
              );
              tr.setMeta(META_KEY, {
                from: glyphFrom,
                replacement: rule.replacement,
                pattern: rule.pattern,
              } satisfies PendingSubstitution);
              view.dispatch(tr);
              return true;
            }

            return false;
          },

          /**
           * Backspace immediately after an auto-substitution restores the
           * original ASCII sequence instead of deleting the glyph. The
           * pending state is cleared, so the user can either keep the
           * literal characters or delete/retype a character to trigger
           * the substitution again.
           */
          handleKeyDown(view, event) {
            if (event.key !== "Backspace") {
              return false;
            }

            const pending = getPendingSubstitution(view.state);
            if (!pending) {
              return false;
            }

            const { selection } = view.state;
            const glyphEnd = pending.from + pending.replacement.length;
            if (!selection.empty || selection.from !== glyphEnd) {
              return false;
            }

            // Guard against the glyph having been altered in a way the
            // reducer didn't observe (e.g. a collaborative splice).
            const currentGlyph = view.state.doc.textBetween(
              pending.from,
              glyphEnd,
              "\n",
              "\n",
            );
            if (currentGlyph !== pending.replacement) {
              return false;
            }

            const tr = view.state.tr.insertText(
              pending.pattern,
              pending.from,
              glyphEnd,
            );
            tr.setMeta(META_KEY, null);
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
