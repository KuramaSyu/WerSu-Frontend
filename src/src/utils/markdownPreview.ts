/**
 * Markdown stripping pipeline for the preview text shown in
 * `DirectoryItem` and the frequently-used side panel.
 *
 * Each step is a class implementing `MarkdownTransform`. The order of
 * the steps in `defaultPipeline` below is the order they run.
 */

const TABLE_HEADER_SEPARATOR = " | ";
const TABLE_ROW_SEPARATOR = ", ";

// Alignment row in a GFM table. Leading pipe is optional; CommonMark
// also allows up to three leading spaces.
const TABLE_ALIGNMENT_ROW = /^\|?\s*:?-{2,}:?(\s*\|\s*:?-{2,}:?)+\s*\|?\s*$/;

/**
 * Contract every stripping step fulfils. Implementations are pure
 * synchronous `text -> text` rewrites; side effects are forbidden so
 * the pipeline stays safe inside a React render.
 */
export interface MarkdownTransform {
  /** Short label used by debug logs and test names. */
  readonly name: string;
  /** One transformation pass. Receives the post-pipeline text and returns the rewritten text. */
  rewrite(text: string): string;
}

/**
 * Runs a list of transforms in declared order over a single piece of
 * text. Order matters -- each step assumes the previous ones have
 * already cleaned up the input.
 */
export class MarkdownPreviewPipeline {
  constructor(private readonly steps: readonly MarkdownTransform[]) {}

  apply(text: string): string {
    let current = text;
    for (const step of this.steps) {
      current = step.rewrite(current);
    }
    return current;
  }
}

/**
 * Collapses a markdown table block whose rows are joined with `|`.
 * Header row cells are separated with `|`, every data row with `,`.
 */
const flattenTableBlock = (block: string): string => {
  const rows = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("|") ||
        /^\[[^\]]+\]\(/.test(line) ||
        /^[^|\s][^|]*\|/.test(line),
    );
  if (rows.length === 0) {
    return "";
  }
  const contentRows = rows.filter((row) => !TABLE_ALIGNMENT_ROW.test(row));
  if (contentRows.length === 0) {
    return "";
  }
  const cellsOf = (row: string): string[] =>
    row
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

  return contentRows
    .map((row, index) =>
      cellsOf(row).join(
        index === 0 ? TABLE_HEADER_SEPARATOR : TABLE_ROW_SEPARATOR,
      ),
    )
    .filter((row) => row.length > 0)
    .join(" ");
};

// Flattens GFM-style pipe blocks. The leading pipe on each row is
// optional; the cell separator itself is required.
export class TableTransform implements MarkdownTransform {
  readonly name = "tables";
  rewrite(text: string): string {
    return text.replace(
      /(?:^[ \t]*\|?[^\n|]*\|[^\n]*\r?\n?)+/gm,
      (block) => `${flattenTableBlock(block)}\n`,
    );
  }
}

// Drops the opening and closing fence lines but leaves the body alone.
// Up to three spaces of indent are allowed on both fence lines and
// must match (CommonMark).
export class FencedCodeTransform implements MarkdownTransform {
  readonly name = "fenced-code";
  rewrite(text: string): string {
    return text.replace(
      /(?:^|\n)([ \t]{0,3})(```+|~~~+)[^\n]*\n([\s\S]*?)\n\1\2[ \t]*(?=\n|$)/g,
      "\n$3",
    );
  }
}

// Inline code: drop the backticks, keep the code text.
export class InlineCodeTransform implements MarkdownTransform {
  readonly name = "inline-code";
  rewrite(text: string): string {
    return text.replace(/`+([^`\n]+?)`+/g, "$1");
  }
}

// ATX headings: drop the leading and trailing `#` runs.
export class HeadingTransform implements MarkdownTransform {
  readonly name = "headings";
  rewrite(text: string): string {
    let next = text.replace(/^\s{0,3}#{1,6}\s+/gm, "");
    next = next.replace(/\s#{1,6}\s*$/gm, "");
    return next;
  }
}

// Images and links. Images are matched first so the leading `!`
// doesn't trip the link regex; the reference-style link is matched
// last so the inline form runs cleanly first.
export class MediaTransform implements MarkdownTransform {
  readonly name = "media";
  rewrite(text: string): string {
    let next = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
    next = next.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    next = next.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");
    return next;
  }
}

// List markers, blockquote markers (any number of `>`), and leading
// horizontal rules -- all stripped to clean prose.
export class ListMarkersTransform implements MarkdownTransform {
  readonly name = "list-markers";
  rewrite(text: string): string {
    let next = text.replace(/^\s{0,3}>+\s?/gm, "");
    next = next.replace(/^\s{0,3}[-*+]\s+/gm, "");
    next = next.replace(/^\s{0,3}\d+\.\s+/gm, "");
    next = next.replace(/^\s{0,3}([-*_])\1{2,}\s*$/gm, "");
    return next;
  }
}

// Bold and italic markers. The double-marker passes run first so the
// single-marker passes don't double-fire on the same text.
export class EmphasisTransform implements MarkdownTransform {
  readonly name = "emphasis";
  rewrite(text: string): string {
    let next = text.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
    next = next.replace(/__([^_\n]+?)__/g, "$1");
    next = next.replace(/\*([^*\n]+?)\*/g, "$1");
    next = next.replace(/(^|\W)_([^_\n]+?)_(?=\W|$)/g, "$1$2");
    return next;
  }
}

// Backslash escapes (so `\*` becomes `*`) and any leftover inline
// HTML tags. Runs last among the structural passes.
export class MiscTransform implements MarkdownTransform {
  readonly name = "misc";
  rewrite(text: string): string {
    let next = text.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1");
    next = next.replace(/<\/?[a-zA-Z][^>]*>/g, "");
    return next;
  }
}

// Collapses every run of whitespace -- newlines, tabs, multiple
// spaces -- into a single space, then trims the ends. Runs last so
// the structural passes can rely on the original line structure.
export class WhitespaceTransform implements MarkdownTransform {
  readonly name = "whitespace";
  rewrite(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }
}

export interface MarkdownPreviewOptions {
  /**
   * Soft cap on the returned string length. The function trims to
   * `maxLength + 100` characters so the caller doesn't need to align
   * its own line-clamp math with our truncation. Defaults to 100.
   */
  maxLength?: number;
}

const defaultPipeline = new MarkdownPreviewPipeline([
  new TableTransform(),
  new FencedCodeTransform(),
  new InlineCodeTransform(),
  new HeadingTransform(),
  new MediaTransform(),
  new ListMarkersTransform(),
  new EmphasisTransform(),
  new MiscTransform(),
  new WhitespaceTransform(),
]);

// Convert a markdown snippet into a plain-text preview. Runs every
// transform in the pipeline, then trims to `maxLength + 100` chars
// and appends a trailing ellipsis when it had to cut.
export function markdownPreview(
  raw: string,
  options: MarkdownPreviewOptions = {},
): string {
  const { maxLength = 100 } = options;
  const limit = maxLength + 100;
  if (!raw) {
    return "";
  }

  let text = defaultPipeline.apply(raw);

  if (text.length > limit) {
    text = text.slice(0, limit).trimEnd();
    if (!text.endsWith("…")) {
      text += "…";
    }
  }

  return text;
}
