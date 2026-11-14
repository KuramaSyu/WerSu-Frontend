// Section-aware note reference tokens for the editor's context menu.
//
// A note reference can point at the whole note (`{{@note-1}}`) or at one
// heading's section (`{{@note-1#details}}`). The heading slug comes from
// the same `HeadingIds` list the outline and `?section=` deep-links use,
// so a copied reference always resolves back to the heading the user
// right-clicked in.

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { collectHeadingEntries } from "../pages/NotePage/headingIds";
import { formatNoteReferenceToken } from "./noteReferences";

/**
 * Slug of the heading whose section contains `pos`, or an empty string
 * when the position sits before the first heading (the note's main /
 * "global" content).
 */
export function headingSlugAtPos(
  doc: ProseMirrorNode,
  pos: number,
): string {
  const target = Math.max(0, pos);
  let slug = "";
  for (const entry of collectHeadingEntries(doc)) {
    // `pos` is just before the heading node; a caret anywhere inside the
    // heading or its body belongs to that section.
    if (entry.pos > target) break;
    slug = entry.id;
  }
  return slug;
}

/**
 * Build the canonical token for a note at a document position. Drops the
 * section part for content before the first heading.
 */
export function buildSectionReferenceToken(
  noteId: string,
  doc: ProseMirrorNode,
  pos: number,
): string {
  const normalizedId = noteId.trim();
  if (!normalizedId) return "";
  return formatNoteReferenceToken(normalizedId, headingSlugAtPos(doc, pos));
}