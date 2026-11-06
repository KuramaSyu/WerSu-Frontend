// ---------------------------------------------------------------------------
// HeadingIds
// Stamps each heading's slug as an `id` on its DOM element via ProseMirror
// node decorations.
//
// Assigning `element.id = slug` imperatively (the previous approach) is not
// durable: the view recreates a heading's DOM node on many updates (the
// initial Y.Doc sync, collaborative edits, decoration changes) and the id
// is dropped, leaving `document.getElementById` with nothing to find. A
// decoration attribute is re-applied by the view every time it renders the
// node, so ids survive the read <-> write editor rebuild.
//
// `collectHeadingEntries` is the single source of truth for the slug list,
// shared by the decoration plugin and OutlineBridge so the TOC ids and the
// DOM ids can never diverge.
// ---------------------------------------------------------------------------

import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { uniqueSlugify } from "../../utils/slugify";

export interface HeadingEntry {
  /** Doc position just before the heading node. */
  pos: number;
  /** Doc position just after the heading node. */
  end: number;
  level: number;
  textContent: string;
  /** Stable, unique kebab slug used as the DOM id and `?section=` param. */
  id: string;
}

/**
 * All non-empty headings in source order, each with a unique slug. Empty
 * headings are skipped so the outline and the ids agree on what counts.
 */
export function collectHeadingEntries(doc: PMNode): HeadingEntry[] {
  const found: Omit<HeadingEntry, "id">[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const textContent = node.textContent;
    if (textContent.length === 0) return;
    found.push({
      pos,
      end: pos + node.nodeSize,
      level: node.attrs.level ?? 1,
      textContent,
    });
  });
  const slugs = uniqueSlugify(found.map((h) => h.textContent));
  return found.map((entry, index) => ({ ...entry, id: slugs[index] }));
}

interface HeadingIdsState {
  entries: HeadingEntry[];
  decorations: DecorationSet;
}

export const headingIdsPluginKey = new PluginKey<HeadingIdsState>("headingIds");

const buildState = (doc: PMNode): HeadingIdsState => {
  const entries = collectHeadingEntries(doc);
  const decorations = DecorationSet.create(
    doc,
    entries.map((entry) =>
      Decoration.node(entry.pos, entry.end, { id: entry.id }),
    ),
  );
  return { entries, decorations };
};

/**
 * Keeps `id` on every heading's DOM element. The state is rebuilt on any
 * doc change (a single linear pass, same order as the outline signature
 * walk it replaces) and reused untouched for selection-only transactions.
 */
export const HeadingIds = Extension.create({
  name: "headingIds",
  addProseMirrorPlugins() {
    return [
      new Plugin<HeadingIdsState>({
        key: headingIdsPluginKey,
        state: {
          init: (_config, state) => buildState(state.doc),
          apply: (tr, value) => (tr.docChanged ? buildState(tr.doc) : value),
        },
        props: {
          decorations: (state) =>
            headingIdsPluginKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});
