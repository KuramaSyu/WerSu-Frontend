// noteStats
//
// Counters the metadata panel shows under "Content". Every metric is
// produced by a single strategy per document construct, so the rules
// for a construct live together:
//
//   construct            words      letters     rows
//   ----------------------------------------------------------------
//   paragraph / heading  its text   its text    1 (blank => 0)
//   bullet / ordered /   its text   its text    1 per item
//     task item                                     (nested too)
//   table                its text   its text    1 per table row
//   code block           its text   its text    1 per physical line
//   image                alt/text   alt/text    1
//   atom block           its text   its text    1
//   container            -          -           descend into children
//     (blockquote, details)
//
// Words are non-whitespace runs; letters are Unicode letters (`\p{L}`),
// so digits and punctuation don't count. `Node.textContent` does *not*
// insert separators between block nodes, so text is extracted with
// `textBetween(..., "\n")` to keep adjacent paragraphs apart.

import type { Node as PMNode } from "@tiptap/pm/model";

const LETTER_RE = /\p{L}/gu;
const WORD_RE = /\S+/g;

export interface NoteStats {
  words: number;
  letters: number;
  rows: number;
}

/**
 * One strategy per document construct. `matches` decides whether the
 * strategy owns a block node; `count` returns the words, letters and
 * rows for that construct. A matching strategy owns the whole subtree,
 * so `count` must account for any nested content it cares about.
 */
export interface CountStrategy {
  readonly name: string;
  matches(node: PMNode): boolean;
  count(node: PMNode): NoteStats;
}

export const countWords = (text: string): number =>
  text.match(WORD_RE)?.length ?? 0;

export const countLetters = (text: string): number =>
  text.match(LETTER_RE)?.length ?? 0;

/** Text of a node with block boundaries preserved as `\n`. */
const textOf = (node: PMNode): string =>
  node.textBetween(0, node.content.size, "\n");

/** Words and letters from `node`'s text, plus an explicit row count. */
const statsFor = (node: PMNode, rows: number): NoteStats => {
  const text = textOf(node);
  return { words: countWords(text), letters: countLetters(text), rows };
};

const LIST_TYPES = new Set(["bulletList", "orderedList", "taskList"]);
const LIST_ITEM_TYPES = new Set(["listItem", "taskItem"]);

/** Number of descendants of `node` (excluding `node`) matching `predicate`. */
const countDescendants = (
  node: PMNode,
  predicate: (child: PMNode) => boolean,
): number => {
  let total = 0;
  node.forEach((child) => {
    if (predicate(child)) total += 1;
    total += countDescendants(child, predicate);
  });
  return total;
};

const tableStrategy: CountStrategy = {
  name: "table",
  matches: (node) => node.type.name === "table",
  // One row per `<tr>`; wrapped cell text still belongs to its row.
  count: (table) =>
    statsFor(
      table,
      countDescendants(table, (child) => child.type.name === "tableRow"),
    ),
};

const listStrategy: CountStrategy = {
  name: "list",
  matches: (node) => LIST_TYPES.has(node.type.name),
  // One row per bullet / number / checkbox. `countDescendants` walks
  // into nested lists, so indented items count once each.
  count: (list) =>
    statsFor(
      list,
      countDescendants(list, (child) => LIST_ITEM_TYPES.has(child.type.name)),
    ),
};

const codeBlockStrategy: CountStrategy = {
  name: "codeBlock",
  matches: (node) => node.type.name === "codeBlock",
  // A code block owns as many rows as it has physical lines.
  count: (node) => {
    const text = node.textContent;
    return statsFor(node, text.length ? text.split("\n").length : 0);
  },
};

const imageStrategy: CountStrategy = {
  name: "image",
  matches: (node) => node.type.name === "image",
  count: (node) => statsFor(node, 1),
};

const textBlockStrategy: CountStrategy = {
  name: "textBlock",
  matches: (node) => node.isTextblock,
  // A paragraph / heading is one row no matter how far it wraps. Blank
  // blocks stay at zero so an empty document reports no rows.
  count: (node) => statsFor(node, node.textContent.trim().length > 0 ? 1 : 0),
};

const atomBlockStrategy: CountStrategy = {
  name: "atomBlock",
  // Images, horizontal rules, embeds, math blocks, raw HTML, ...
  matches: (node) => node.isBlock && node.isAtom,
  count: (node) => statsFor(node, 1),
};

// Priority order: specific constructs before the generic leaf fallback.
export const STATS_STRATEGIES: readonly CountStrategy[] = [
  tableStrategy,
  listStrategy,
  codeBlockStrategy,
  imageStrategy,
  textBlockStrategy,
  atomBlockStrategy,
];

export const pickStatsStrategy = (node: PMNode): CountStrategy | null =>
  STATS_STRATEGIES.find((strategy) => strategy.matches(node)) ?? null;

/**
 * Counts words, letters and rows over a ProseMirror document. Matched
 * constructs contribute their strategy's totals; unmatched containers
 * (blockquote, details, ...) are descended into.
 */
export const computeStats = (doc: PMNode): NoteStats => {
  const total: NoteStats = { words: 0, letters: 0, rows: 0 };
  const visit = (node: PMNode) => {
    node.forEach((child) => {
      const strategy = pickStatsStrategy(child);
      if (strategy) {
        const counted = strategy.count(child);
        total.words += counted.words;
        total.letters += counted.letters;
        total.rows += counted.rows;
        return; // The strategy owns the whole subtree.
      }
      visit(child);
    });
  };
  visit(doc);
  return total;
};
