/**
 * Helpers for the full-width "header image" banner shown on top of
 * directory and note pages.
 *
 * A header image is just an inline Markdown image stored at the top of
 * the owning document:
 *
 *   - directories keep it in their `README.md`, using the `bookImage`
 *     alt that `serializeReadme` already writes.
 *   - notes keep it in their own Markdown body, using the `HeaderImage`
 *     alt. Only the first 10 lines are scanned, so an image lower down
 *     the note is never mistaken for the header.
 *
 * The image is rendered separately from the editor body, so the editor
 * strips the header line before showing the note and re-adds it on
 * save (see `stripNoteHeaderImage` / `composeNoteContent`).
 */

/** Alt text that marks a note's header image. */
export const NOTE_HEADER_IMAGE_ALT = "HeaderImage";

/** Alt text that marks a directory README's header image. */
export const DIRECTORY_HEADER_IMAGE_ALT = "bookImage";

/** Number of leading note lines scanned for a `HeaderImage`. */
export const NOTE_HEADER_SCAN_LINES = 10;

export interface HeaderImage {
  /** Alt text exactly as written in the Markdown. */
  alt: string;
  /** Raw image URL (no surrounding whitespace). */
  url: string;
  /** The full inline image Markdown (`![alt](url)`). */
  markdown: string;
  /** Zero-based line index the image was found on. */
  lineIndex: number;
}

const IMAGE_PATTERN = /!\[([^\]]*)\]\(\s*([^)]+?)\s*\)/;

const parseHeaderLine = (line: string, alt: string): HeaderImage | null => {
  const match = IMAGE_PATTERN.exec(line);
  if (!match) {
    return null;
  }
  if (match[1].trim().toLowerCase() !== alt.toLowerCase()) {
    return null;
  }
  return {
    alt: match[1].trim(),
    url: match[2].trim(),
    markdown: match[0],
    lineIndex: 0,
  };
};

/**
 * Finds the first inline image with the given alt in the leading
 * `maxLines` lines of `content`. Pass `Infinity` to scan the whole
 * document.
 */
export function findHeaderImage(
  content: string | null | undefined,
  alt: string,
  maxLines: number = Infinity,
): HeaderImage | null {
  if (!content) {
    return null;
  }
  const lines = content.split(/\r?\n/);
  const limit = Math.min(lines.length, maxLines);
  for (let index = 0; index < limit; index += 1) {
    const found = parseHeaderLine(lines[index], alt);
    if (found) {
      return { ...found, lineIndex: index };
    }
  }
  return null;
}

/** Finds a note's `HeaderImage` within the first 10 lines. */
export function findNoteHeaderImage(
  content: string | null | undefined,
): HeaderImage | null {
  return findHeaderImage(content, NOTE_HEADER_IMAGE_ALT, NOTE_HEADER_SCAN_LINES);
}

/** Finds a directory README's `bookImage` anywhere in its header. */
export function findDirectoryHeaderImage(
  content: string | null | undefined,
): HeaderImage | null {
  return findHeaderImage(content, DIRECTORY_HEADER_IMAGE_ALT);
}

/** Extracts the URL from an inline image Markdown snippet. */
export function extractImageUrl(markdown: string | null | undefined): string | null {
  if (!markdown) {
    return null;
  }
  const match = IMAGE_PATTERN.exec(markdown);
  return match ? match[2].trim() : null;
}

/** Builds the inline image Markdown for a header image. */
export function buildHeaderImageMarkdown(url: string, alt: string): string {
  return `![${alt}](${url.trim()})`;
}

/**
 * Removes the first matching header image from `content`. Only the
 * leading `maxLines` lines are considered so a `HeaderImage` deep in
 * the body is left untouched.
 */
export function removeHeaderImage(
  content: string | null | undefined,
  alt: string,
  maxLines: number = Infinity,
): string {
  const source = content ?? "";
  const found = findHeaderImage(source, alt, maxLines);
  if (!found) {
    return source;
  }
  const lines = source.split(/\r?\n/);
  lines.splice(found.lineIndex, 1);
  // Drop the (usually blank) line that followed the header image, then
  // any leading blank lines, so the remaining body starts cleanly.
  if (lines[found.lineIndex] !== undefined && lines[found.lineIndex].trim() === "") {
    lines.splice(found.lineIndex, 1);
  }
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  return lines.join("\n");
}

/** Strips a note's `HeaderImage` line before the body reaches the editor. */
export function stripNoteHeaderImage(
  content: string | null | undefined,
): string {
  return removeHeaderImage(content, NOTE_HEADER_IMAGE_ALT, NOTE_HEADER_SCAN_LINES);
}

/**
 * Inserts or replaces a header image in `content`.
 *
 * An existing header (within `maxLines`) is replaced in place so the
 * rest of the document is untouched. Otherwise the image is prepended
 * above the first non-blank line.
 */
export function upsertHeaderImage(
  content: string | null | undefined,
  alt: string,
  url: string,
  maxLines: number = Infinity,
): string {
  const markdown = buildHeaderImageMarkdown(url, alt);
  const source = content ?? "";
  const lines = source.split(/\r?\n/);

  const found = findHeaderImage(source, alt, maxLines);
  if (found) {
    lines[found.lineIndex] = markdown;
    return lines.join("\n");
  }

  // Prepend above the first non-blank line (or at the very top for an
  // empty document).
  const firstContent = lines.findIndex((line) => line.trim().length > 0);
  const insertAt = firstContent < 0 ? 0 : firstContent;
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  return [...before, markdown, "", ...after].join("\n").replace(/^\n+/, "");
}

/** Inserts or replaces a note's `HeaderImage`. */
export function upsertNoteHeaderImage(
  content: string | null | undefined,
  url: string,
): string {
  return upsertHeaderImage(
    content,
    NOTE_HEADER_IMAGE_ALT,
    url,
    NOTE_HEADER_SCAN_LINES,
  );
}

/**
 * Combines an editor body with the note's header Markdown on save.
 * The editor body never contains the header (it is stripped on load),
 * so this is the single place that re-attaches it.
 */
export function composeNoteContent(
  body: string | null | undefined,
  headerMarkdown: string | null | undefined,
): string {
  const cleanBody = stripNoteHeaderImage(body ?? "").trimStart();
  const header = headerMarkdown?.trim();
  if (!header) {
    return cleanBody;
  }
  if (!cleanBody) {
    return header;
  }
  return `${header}\n\n${cleanBody}`;
}
