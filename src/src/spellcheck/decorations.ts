// ProseMirror decorations for misspelled words.
//
// The scan walks the document once per rebuild and skips anything
// that is code or maths, so a fenced block never lights up red.

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { SpellChecker } from "./dictionary";
import { extractWordRanges } from "./words";

/** Class painted by `styles/tiptap.css` as a wavy underline. */
export const SPELLCHECK_ERROR_CLASS = "spellcheck-error";

/** Node names that never contain prose. `spec.code` covers code blocks. */
const SKIPPED_NODE_NAMES = new Set([
  "codeBlock",
  "inlineMath",
  "blockMath",
  "mathematics",
]);

function isProseText(
  node: ProseMirrorNode,
): node is ProseMirrorNode & { text: string } {
  if (!node.isText || !node.text) return false;
  if (SKIPPED_NODE_NAMES.has(node.type.name)) return false;
  if (node.type.spec.code) return false;
  if (node.marks.some((mark) => mark.type.spec.code)) return false;
  return true;
}

/** Build the decoration set for a whole document. */
export function buildSpellcheckDecorations(
  doc: ProseMirrorNode,
  checker: SpellChecker,
): DecorationSet {
  const decorations: Decoration[] = [];
  // The same word usually appears several times; check it once.
  const verdicts = new Map<string, boolean>();

  doc.descendants((node, pos) => {
    if (node.type.spec.code || SKIPPED_NODE_NAMES.has(node.type.name)) {
      return false;
    }
    if (!isProseText(node)) return undefined;

    for (const range of extractWordRanges(node.text)) {
      let misspelled = verdicts.get(range.word);
      if (misspelled === undefined) {
        misspelled = !checker.check(range.word);
        verdicts.set(range.word, misspelled);
      }
      if (!misspelled) continue;

      decorations.push(
        Decoration.inline(
          pos + range.from,
          pos + range.to,
          { class: SPELLCHECK_ERROR_CLASS },
          { word: range.word },
        ),
      );
    }

    return undefined;
  });

  return DecorationSet.create(doc, decorations);
}