import type { NoteReference } from "../api/models/search";
import { uniqueSlugify } from "./slugify";

/**
 * Exact message the backend puts in `NoteReference.content` when the
 * current viewer is not allowed to read the referenced note. The
 * reference stays in the array (and therefore in the note) on purpose;
 * the UI renders it as an access-denied block instead of dropping it.
 */
export const NOTE_REFERENCE_ACCESS_DENIED =
  "Error: user has no permission to view the referenced note";

/** Parsed form of a raw `{{@note-id#section-slug}}` token. */
export interface NoteReferenceTarget {
  noteId: string;
  /** Heading slug; empty string means the whole referenced note. */
  section: string;
}

/**
 * Matches a complete reference token. Ids may not contain `#`, `}` or
 * whitespace; sections may not contain `}` or whitespace. This mirrors
 * the token shape documented by the backend.
 */
export const NOTE_REFERENCE_TOKEN_PATTERN =
  /\{\{@([^#\s{}]+)(?:#([^}\s]+))?\}\}/;

/** Match at the start of a tokenizer chunk. */
export const NOTE_REFERENCE_TOKEN_AT_START_PATTERN =
  /^\{\{@([^#\s{}]+)(?:#([^}\s]+))?\}\}/;

/** Parse a complete or leading `{{@...}}` token, or return null. */
export function parseNoteReferenceToken(
  raw: string,
): NoteReferenceTarget | null {
  const match = NOTE_REFERENCE_TOKEN_PATTERN.exec(raw.trim());
  if (!match) return null;
  return {
    noteId: match[1],
    section: match[2] ?? "",
  };
}

/** Serialize a target back into the canonical raw token. */
export function formatNoteReferenceToken(
  noteId: string,
  section: string,
): string {
  const normalizedId = noteId.trim();
  const normalizedSection = section.trim();
  return normalizedSection
    ? `{{@${normalizedId}#${normalizedSection}}}`
    : `{{@${normalizedId}}}`;
}

/**
 * Lookup key used by both the resolver and the raw token. Keeping this
 * in one place prevents `note-1#` vs `note-1` mismatches.
 */
export function noteReferenceLookupKey(
  noteId: string,
  section: string,
): string {
  const normalizedId = noteId.trim();
  const normalizedSection = section.trim();
  return normalizedSection
    ? `${normalizedId}#${normalizedSection}`
    : normalizedId;
}

/** Find the backend-resolved reference matching a target. */
export function findNoteReference(
  references: readonly NoteReference[] | undefined,
  noteId: string,
  section: string,
): NoteReference | undefined {
  if (!references || references.length === 0) return undefined;
  const targetKey = noteReferenceLookupKey(noteId, section);
  return references.find(
    (reference) =>
      noteReferenceLookupKey(reference.note_id, reference.section ?? "") ===
      targetKey,
  );
}

/** True when the resolved content is the backend's permission error. */
export function isNoteReferenceAccessDenied(content: string): boolean {
  return content.trim() === NOTE_REFERENCE_ACCESS_DENIED;
}

/**
 * Build the in-app URL for a referenced note, including the heading
 * section (same `?section=` deep-link shape the note page already
 * honours).
 */
export function buildNoteReferenceHref(
  noteId: string,
  section: string,
): string {
  const normalizedSection = section.trim();
  const path = `/n/${encodeURIComponent(noteId.trim())}`;
  return normalizedSection
    ? `${path}?section=${encodeURIComponent(normalizedSection)}`
    : path;
}


/** Heading section parsed from a referenced note's raw markdown. */
export interface NoteSection {
  /** Stable slug (same algorithm as the editor's heading ids). */
  slug: string;
  /** Plain-text heading title. */
  title: string;
  /** Heading level 1..6. */
  level: number;
  /** Heading line plus its body, up to the next same/higher heading. */
  markdown: string;
  /** Body without the heading line. */
  content: string;
}

interface HeadingCandidate {
  startLine: number;
  endLine: number;
  level: number;
  title: string;
}

/** Strip common inline Markdown from a heading before slugging it. */
function plainHeadingText(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse ATX / setext headings from raw markdown, ignoring headings
 * inside fenced code blocks. Slugs are unique across the note and match
 * the editor's `HeadingIds` algorithm.
 */
export function extractNoteSections(markdown: string): NoteSection[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const candidates: HeadingCandidate[] = [];
  let fenceChar: "`" | "~" | null = null;
  let fenceLength = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    const fence = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fence) {
      const char = fence[1][0] as "`" | "~";
      if (fenceChar === null) {
        fenceChar = char;
        fenceLength = fence[1].length;
      } else if (char === fenceChar && fence[1].length >= fenceLength) {
        fenceChar = null;
        fenceLength = 0;
      }
      continue;
    }
    if (fenceChar !== null) continue;

    const atx = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*$/.exec(line);
    if (atx) {
      const rawTitle = atx[2].replace(/[ \t]+#+[ \t]*$/, "");
      const title = plainHeadingText(rawTitle);
      if (title) {
        candidates.push({
          startLine: i,
          endLine: i + 1,
          level: atx[1].length,
          title,
        });
      }
      continue;
    }

    // Setext headings: a non-empty line followed by === or ---.
    const next = lines[i + 1] ?? "";
    const setext = /^ {0,3}(=+|-+)[ \t]*$/.exec(next);
    if (setext && trimmed.length > 0) {
      const title = plainHeadingText(line);
      if (title) {
        candidates.push({
          startLine: i,
          endLine: i + 2,
          level: setext[1][0] === "=" ? 1 : 2,
          title,
        });
        i += 1;
      }
    }
  }

  const slugs = uniqueSlugify(candidates.map((c) => c.title));

  return candidates.map((candidate, index) => {
    let endLine = lines.length;
    for (let next = index + 1; next < candidates.length; next += 1) {
      if (candidates[next].level <= candidate.level) {
        endLine = candidates[next].startLine;
        break;
      }
    }

    const sectionLines = lines.slice(candidate.startLine, endLine);
    while (
      sectionLines.length > 0 &&
      sectionLines[sectionLines.length - 1].trim() === ""
    ) {
      sectionLines.pop();
    }

    const bodyLines = lines.slice(candidate.endLine, endLine);
    while (
      bodyLines.length > 0 &&
      bodyLines[bodyLines.length - 1].trim() === ""
    ) {
      bodyLines.pop();
    }

    return {
      slug: slugs[index],
      title: candidate.title,
      level: candidate.level,
      markdown: sectionLines.join("\n"),
      content: bodyLines.join("\n"),
    };
  });
}

/** Normalize a user-entered section (`#details` / `details`). */
export function normalizeNoteSectionSlug(section: string): string {
  return section.trim().replace(/^#+/, "");
}

/** Find a parsed section by slug. */
export function findNoteSection(
  markdown: string,
  section: string,
): NoteSection | undefined {
  const slug = normalizeNoteSectionSlug(section);
  if (!slug) return undefined;
  return extractNoteSections(markdown).find((entry) => entry.slug === slug);
}
