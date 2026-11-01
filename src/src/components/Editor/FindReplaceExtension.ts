// ---------------------------------------------------------------------------
// FindReplaceExtension
// ProseMirror plugin backing the in-note find widget for the rich
// editor. Its only jobs are:
//   1. compute the document matches for the current query/options,
//   2. paint them with inline decorations (active match distinct),
//   3. expose imperative helpers the React widget drives.
//
// Replace operations themselves run through ordinary Tiptap
// transactions in the widget (insertContentAt), so this file stays a
// thin highlight matcher. The plugin recomputes matches on every
// transaction so the highlight follows edits while the widget is open.
// ---------------------------------------------------------------------------

import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  DEFAULT_FIND_REPLACE_OPTIONS,
  findTextMatches,
  type FindReplaceOptions,
} from "./findReplace";

/** A match resolved to absolute ProseMirror document positions. */
export interface DocumentMatch {
  from: number;
  to: number;
  /** Matched substring (used to expand `$&` / preserve case). */
  text: string;
  /** Regex capture groups (empty for literal searches). */
  groups: string[];
}

export interface FindReplaceState {
  query: string;
  options: FindReplaceOptions;
  activeIndex: number;
  matches: DocumentMatch[];
}

interface FindReplaceMeta {
  query?: string;
  options?: FindReplaceOptions;
  activeIndex?: number;
  clear?: boolean;
}

export const findReplacePluginKey = new PluginKey<FindReplaceState>(
  "findReplace",
);

const EMPTY_STATE: FindReplaceState = {
  query: "",
  options: DEFAULT_FIND_REPLACE_OPTIONS,
  activeIndex: -1,
  matches: [],
};

interface TextSegment {
  /** Flat text of one textblock (paragraph, heading, code block, cell...). */
  text: string;
  /** Document position of each character in `text`. */
  positions: number[];
}

/**
 * Flatten the document into strings, tracking the document position
 * of each character. Each textblock yields one or more segments: an
 * inline atom (image, hard break, math) starts a new segment so a
 * match can never span it, and matches cannot leak across blocks.
 */
export function collectTextSegments(doc: PMNode): TextSegment[] {
  const segments: TextSegment[] = [];

  const visit = (node: PMNode, pos: number): void => {
    if (node.isTextblock) {
      // Inline atoms (images, hard breaks, math) split the block into
      // sub-segments so a match can never span an opaque node.
      let chars: string[] = [];
      let positions: number[] = [];
      const flush = () => {
        if (chars.length === 0) return;
        segments.push({ text: chars.join(""), positions });
        chars = [];
        positions = [];
      };
      node.forEach((child, offset) => {
        const childPos = pos + 1 + offset;
        if (child.isText) {
          const value = child.text ?? "";
          for (let i = 0; i < value.length; i += 1) {
            chars.push(value[i]);
            positions.push(childPos + i);
          }
        } else if (child.isInline) {
          flush();
        }
      });
      flush();
      return;
    }
    node.forEach((child, offset) => visit(child, pos + 1 + offset));
  };

  doc.forEach((child, offset) => visit(child, offset));
  return segments;
}

/** Resolve matches in a document for the given query/options. */
export function findDocumentMatches(
  doc: PMNode,
  query: string,
  options: FindReplaceOptions,
): DocumentMatch[] {
  if (!query) return [];
  const matches: DocumentMatch[] = [];
  for (const segment of collectTextSegments(doc)) {
    for (const match of findTextMatches(segment.text, query, options)) {
      const from = segment.positions[match.from];
      const to = segment.positions[match.to - 1];
      if (from === undefined || to === undefined) continue;
      matches.push({
        from,
        to: to + 1,
        text: match.text,
        groups: match.groups,
      });
    }
  }
  return matches;
}

function computeState(
  doc: PMNode,
  base: FindReplaceState,
  patch: FindReplaceMeta | undefined,
): FindReplaceState {
  if (patch?.clear) return EMPTY_STATE;
  const query = patch?.query ?? base.query;
  const options = patch?.options ?? base.options;
  let activeIndex = patch?.activeIndex ?? base.activeIndex;
  const matches = findDocumentMatches(doc, query, options);
  if (matches.length === 0) {
    activeIndex = -1;
  } else if (activeIndex < 0) {
    activeIndex = 0;
  } else if (activeIndex >= matches.length) {
    activeIndex = matches.length - 1;
  }
  return { query, options, activeIndex, matches };
}

export const FindReplaceExtension = Extension.create({
  name: "findReplace",

  addProseMirrorPlugins() {
    return [
      new Plugin<FindReplaceState>({
        key: findReplacePluginKey,
        state: {
          init: () => EMPTY_STATE,
          apply(tr, value) {
            const meta = tr.getMeta(findReplacePluginKey) as
              | FindReplaceMeta
              | undefined;
            return computeState(tr.doc, value, meta);
          },
        },
        props: {
          decorations(state) {
            const find = findReplacePluginKey.getState(state);
            if (!find || find.matches.length === 0) return null;
            const decorations = find.matches.map((match, index) =>
              Decoration.inline(match.from, match.to, {
                class:
                  index === find.activeIndex
                    ? "find-replace-match find-replace-match--active"
                    : "find-replace-match",
              }),
            );
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

/** Read the plugin state, or `undefined` when the extension is absent. */
export function getFindReplaceState(
  editor: Editor,
): FindReplaceState | undefined {
  return findReplacePluginKey.getState(editor.state);
}

/**
 * Update query / options / active index. Dispatched with
 * `addToHistory: false` so find navigation never lands on the undo
 * stack, and no document change is produced.
 */
export function setFindReplaceState(
  editor: Editor,
  patch: FindReplaceMeta,
): void {
  if (editor.isDestroyed) return;
  const tr = editor.state.tr
    .setMeta(findReplacePluginKey, patch)
    .setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}

/** Clear matches and decorations (used when the widget closes). */
export function clearFindReplaceState(editor: Editor): void {
  if (editor.isDestroyed) return;
  const current = getFindReplaceState(editor);
  if (!current || (!current.query && current.matches.length === 0)) return;
  setFindReplaceState(editor, { clear: true });
}
