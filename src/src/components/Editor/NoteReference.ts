// Inline atom for embedded note references:
//
//   {{@note-2#details}}  -> target note-2, heading slug "details"
//   {{@note-3}}          -> whole note-3
//
// The node deliberately stores only the raw target (note id + section).
// Resolved content is never written into the document, so the token
// round-trips byte-for-byte and saving a note cannot replace it with a
// stale copy of the referenced note. The click-to-open modal in
// `View/CustomNoteReference.tsx` loads the resolved content on demand.
//
// That modal needs `@tiptap/react`/MUI, so the schema + markdown
// handlers live in this MUI-free file to keep parser tests light.

import { Node, mergeAttributes } from "@tiptap/core";
import type {
  JSONContent,
  MarkdownParseResult,
  MarkdownToken,
} from "@tiptap/core";
import {
  NOTE_REFERENCE_TOKEN_AT_START_PATTERN,
  formatNoteReferenceToken,
  parseNoteReferenceToken,
} from "../../utils/noteReferences";

export const NOTE_REFERENCE_NODE_NAME = "noteReference";

export const NoteReference = Node.create({
  name: NOTE_REFERENCE_NODE_NAME,

  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      noteId: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-note-id") ?? "",
      },
      section: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-note-section") ?? "",
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-note-reference]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const noteId = String(node.attrs.noteId ?? "");
    const section = String(node.attrs.section ?? "");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-note-reference": "",
        "data-note-id": noteId,
        "data-note-section": section,
      }),
      formatNoteReferenceToken(noteId, section),
    ];
  },

  markdownTokenName: "noteReference",

  markdownTokenizer: {
    name: "noteReference",
    level: "inline" as const,
    start: (src: string) => src.indexOf("{{@"),
    tokenize: (src: string) => {
      const match = NOTE_REFERENCE_TOKEN_AT_START_PATTERN.exec(src);
      if (!match) return undefined;
      return {
        type: "noteReference",
        raw: match[0],
        noteId: match[1],
        section: match[2] ?? "",
      };
    },
  },

  parseMarkdown: (token: MarkdownToken): MarkdownParseResult => {
    const raw = String(token.raw ?? "");
    const parsed =
      parseNoteReferenceToken(raw) ??
      ({
        noteId: String(token.noteId ?? ""),
        section: String(token.section ?? ""),
      } satisfies { noteId: string; section: string });

    if (!parsed.noteId) {
      // Not claimable as a reference; let the default text parser have it.
      return null as unknown as MarkdownParseResult;
    }

    return {
      type: NOTE_REFERENCE_NODE_NAME,
      attrs: { noteId: parsed.noteId, section: parsed.section },
    } as JSONContent;
  },

  renderMarkdown: (node: JSONContent) => {
    const attrs = node.attrs ?? {};
    return formatNoteReferenceToken(
      String(attrs.noteId ?? ""),
      String(attrs.section ?? ""),
    );
  },
});
