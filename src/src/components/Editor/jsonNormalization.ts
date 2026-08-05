import type { JSONContent } from "@tiptap/react";

/**
 * Normalizes a single table cell or header (which is a cell aswell) so that
 * block-level children (image, codeBlock, blockquote, ...) are lifted out of
 * any wrapping paragraph.
 *
 * Markdown tables parse inline content such as:
 *
 *   | ![](image.png) Hello |
 *
 * into:
 *
 *   tableCell
 *   └─ paragraph
 *      ├─ image
 *      ├─ text("Hello")
 *      ├─ image
 *      └─ text("Hello2")
 * But this structure deletes the image, as soon as the user edits the text.
 * I don't know why. Hence we normalize the content to:
 *
 *   tableCell
 *   ├─ image
 *   └─ paragraph
 *      └─ text("Hello")
 *   ├─ image
 *   └─ paragraph
 *      └─ text("Hello2")
 *
 * Paragraphs that only contain inline content (text, hardBreak, ...) are
 * left unchanged so the cell stays a single-child and the `<br/>` round-trip
 * does not leak the table cell-line separator (U+001F) into the cell text.
 *
 * @param cell A tableCell node.
 * @returns A normalized copy of the table cell.
 */
export function normalizeTableCell(cell: JSONContent): JSONContent {
  const content: JSONContent[] = [];

  for (const child of cell.content ?? []) {
    // destructure paragraphs that contain a block-level child to lift the
    // block node out (otherwise tiptap's `paragraph+` schema rejects the doc).
    // Paragraphs that are inline-only (text, hardBreak, ...) stay intact so
    // the cell remains a single child on serialize.
    content.push(...destructParagraph(child));
  }
  return {
    ...cell,
    content,
  };
}

/**
 * Destructures a paragraph node into its non-paragraph children recursively,
 * but only when the paragraph contains a block-level child that needs to be
 * lifted out (image, codeBlock, blockquote, ...). A paragraph that is
 * inline-only is returned as-is so the cell content stays a single child and
 * the cell round-trip preserves line breaks as `<br/>` without leaking the
 * internal cell-line separator into the cell text.
 *
 * A non paragraph node A is returned as JSONContent[] = [A].
 * A text node is wrapped as a paragraph. Otherwise it's rejected from tiptap.
 * @param paragraph A paragraph node to destructure.
 * @returns JSONContent[] - a flattened array of non-paragraph nodes for the
 *   original paragraph, or `[paragraph]` if it is inline-only.
 */
function destructParagraph(paragraph: JSONContent): JSONContent[] {
  const content: JSONContent[] = [];

  if (paragraph.type === "text") {
    // wrap bare text into a paragraph, otherwise tiptap will reject it
    return [
      {
        type: "paragraph",
        content: [paragraph],
      },
    ];
  } else if (paragraph.type !== "paragraph") {
    // keep other non-paragraph nodes as is
    return [paragraph];
  }

  // Inline-only paragraphs (text + hardBreak + marks) are valid inside a
  // tableCell paragraph. Lifting them would turn the cell into a multi-child
  // array and `extension-table`'s renderTableToMarkdown would join the parts
  // with U+001F without post-processing them, leaking the control char into
  // the cell text on round-trips. Leave inline-only paragraphs alone.
  if (!paragraphHasBlockChild(paragraph)) {
    return [paragraph];
  }

  // destruct paragraph into all its children
  for (const inline of paragraph.content ?? []) {
    // recursively destruct each child.
    // the above conditions will ensure, that images and other are returned as is
    // while text nodes are wrapped into paragraphs and paragaphs are further destructured
    content.push(...destructParagraph(inline));
  }
  return content;
}

/**
 * Returns true when the paragraph contains any child whose type cannot live
 * inside a tiptap paragraph (block groups like image, codeBlock, blockquote).
 * Inline nodes (text, hardBreak) are allowed and don't trigger destructuring.
 */
function paragraphHasBlockChild(paragraph: JSONContent): boolean {
  return (paragraph.content ?? []).some(
    (child) => child.type !== "text" && child.type !== "hardBreak",
  );
}

/**
 * Recursively traverses a Tiptap JSON document and normalizes all table cells.
 *
 * This is intended to run immediately after Markdown deserialization:
 *
 *   markdown -> parse() -> normalizeTables() -> setContent()
 *
 * so that imported table cells follow our preferred structure before they are
 * rendered or edited.
 *
 * @param node Root node to normalize.
 * @returns A normalized copy of the node tree.
 */
export function normalizeTables(node: JSONContent): JSONContent {
  // normalize cells as well as headers. headers are the cells in the head
  const normalized =
    node.type === "tableCell" || node.type === "tableHeader"
      ? normalizeTableCell(node)
      : { ...node };

  if (normalized.content) {
    normalized.content = normalized.content.map(normalizeTables);
  }

  return normalized;
}

/**
 * Classify each line of a cell as a list item or prose, then group
 * consecutive same-class lines into a sequence of nodes that mirrors
 * the cell's structure:
 *
 *   - prose lines become one paragraph each (a prose "run" is just a
 *     single paragraph; a single prose line stays one paragraph).
 *   - 2+ consecutive bullet items (`- a / - b / - c`, all sharing the
 *     same marker) become a `bulletList`.
 *   - 2+ consecutive ordered items (`1. a / 2. b / 3. c`, with
 *     consecutive numbers) become an `orderedList`.
 *   - 1 isolated list-shaped line stays prose (a `- foo` sentence is
 *     not a list).
 *
 * Returns an array of `JSONContent` blocks (paragraph + list, in
 * source order), or `null` if no list runs were found (caller leaves
 * the cell unchanged).
 *
 * Two input shapes are accepted:
 *
 *   1. Single paragraph with alternating `[text, hardBreak, ...]`
 *      children. This is what comes back from re-parsing the
 *      `<br/>`-separated markdown the table renderer emits.
 *   2. Multiple paragraphs, each one text node. This is what a plain
 *      -text paste of `- a\n- b\n- c` produces.
 *
 * Exported for the regression tests.
 */
const BULLET_MARKER = /^([-*+])\s+/;
const ORDERED_MARKER = /^(\d+)\.\s+/;

type CellLine = { kind: "prose"; text: string } | {
  kind: "bullet" | "ordered";
  marker: string;
  text: string;
};

function collectLines(cellContent: JSONContent[]): string[] | null {
  // Shape 1: single paragraph with alternating text/hardBreak children.
  if (
    cellContent.length === 1 &&
    cellContent[0].type === "paragraph"
  ) {
    const inline = cellContent[0].content ?? [];
    if (inline.length === 0) return null;
    const lines: string[] = [];
    for (let i = 0; i < inline.length; i += 1) {
      const node = inline[i];
      if (i % 2 === 0) {
        if (node.type !== "text" || typeof node.text !== "string") {
          return null;
        }
        lines.push(node.text);
      } else {
        if (node.type !== "hardBreak") return null;
      }
    }
    return lines;
  }

  // Shape 2: multiple paragraphs, each a single text node.
  const lines: string[] = [];
  for (const child of cellContent) {
    if (child.type !== "paragraph") return null;
    const inline = child.content ?? [];
    if (inline.length === 0) return null;
    // Allow trailing hardBreak to absorb cases where marked left one.
    const cleaned = inline.filter((n) => n.type !== "hardBreak");
    if (cleaned.length !== 1) return null;
    const only = cleaned[0];
    if (only.type !== "text" || typeof only.text !== "string") return null;
    lines.push(only.text);
  }
  return lines;
}

function classifyLines(lines: string[]): CellLine[] {
  return lines.map((line): CellLine => {
    const bullet = line.match(BULLET_MARKER);
    if (bullet) {
      return {
        kind: "bullet",
        marker: bullet[1],
        text: line.slice(bullet[0].length),
      };
    }
    const ordered = line.match(ORDERED_MARKER);
    if (ordered) {
      return {
        kind: "ordered",
        marker: ordered[1],
        text: line.slice(ordered[0].length),
      };
    }
    return { kind: "prose", text: line };
  });
}

type Run =
  | { kind: "prose"; lines: string[] }
  | { kind: "bulletList"; marker: string; items: string[] }
  | { kind: "orderedList"; start: number; items: string[] };

export type { Run };

function groupRuns(classified: CellLine[]): Run[] {
  const runs: Run[] = [];
  let i = 0;
  while (i < classified.length) {
    const line = classified[i];
    if (line.kind === "prose") {
      runs.push({ kind: "prose", lines: [line.text] });
      i += 1;
      continue;
    }
    // Try to extend a list run forward while the next items match the
    // same kind + marker + (for ordered) consecutive numbers.
    const items: string[] = [line.text];
    let nextNumber =
      line.kind === "ordered" ? Number.parseInt(line.marker, 10) + 1 : 0;
    let j = i + 1;
    while (j < classified.length) {
      const candidate = classified[j];
      if (candidate.kind !== line.kind) break;
      if (candidate.kind === "bullet" && candidate.marker !== line.marker) {
        break;
      }
      if (candidate.kind === "ordered") {
        const n = Number.parseInt(candidate.marker, 10);
        if (n !== nextNumber) break;
        nextNumber += 1;
      }
      items.push(candidate.text);
      j += 1;
    }
    // A single isolated bullet/ordered line is just prose; promote it.
    if (items.length < 2) {
      runs.push({ kind: "prose", lines: [(line as CellLine & { text: string }).text] });
    } else if (line.kind === "bullet") {
      runs.push({
        kind: "bulletList",
        marker: line.marker,
        items,
      });
    } else {
      runs.push({
        kind: "orderedList",
        start: Number.parseInt(line.marker, 10),
        items,
      });
    }
    i = j;
  }
  return runs;
}

/**
 * Split a cell's content into a sequence of paragraph + list nodes
 * where each list-shaped run is converted to a real `bulletList` /
 * `orderedList`. Returns `null` if the cell has no list-shaped runs
 * (caller leaves the cell unchanged). Prose runs inside the cell are
 * preserved as `paragraph` nodes so a cell that mixes prose and a
 * list round-trips as multiple blocks.
 */
export function splitCellIntoRuns(cellContent: JSONContent[]): {
  runs: Run[];
} | null {
  const lines = collectLines(cellContent);
  if (!lines) return null;
  const runs = groupRuns(classifyLines(lines));
  // If there is no list-shaped run, leave the cell as-is. The caller
  // does not need to re-render prose as a list -- the cell already
  // renders prose correctly via the stock `paragraph+` schema.
  if (!runs.some((r) => r.kind !== "prose")) return null;
  return { runs };
}

export function runsToCellContent(runs: Run[]): JSONContent[] {
  const out: JSONContent[] = [];
  for (const run of runs) {
    if (run.kind === "prose") {
      for (const text of run.lines) {
        out.push({
          type: "paragraph",
          content: text.length === 0 ? [] : [{ type: "text", text }],
        });
      }
    } else if (run.kind === "bulletList") {
      out.push({
        type: "bulletList",
        content: run.items.map((text) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text }],
            },
          ],
        })),
      });
    } else {
      out.push({
        type: "orderedList",
        attrs: { start: run.start },
        content: run.items.map((text) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text }],
            },
          ],
        })),
      });
    }
  }
  return out;
}

/**
 * Backwards-compatible single-shot helper: returns `null` if the cell
 * is not list-shaped, otherwise a single-element array containing the
 * rewritten cell content. Kept for callers that only want the
 * "whole-cell is one list" case; `normalizeListInCells` uses
 * `splitCellIntoRuns` to handle mixed prose+list cells.
 */
export function rewriteCellAsList(
  cellContent: JSONContent[],
): JSONContent[] | null {
  const split = splitCellIntoRuns(cellContent);
  if (!split) return null;
  // If there is any non-list run, defer to the mixed-run path. The
  // legacy caller only handled pure-list cells, so signal "this is a
  // mixed cell" by returning `null` from the legacy entry point.
  if (split.runs.some((r) => r.kind === "prose")) return null;
  return runsToCellContent(split.runs);
}

/**
 * @deprecated kept for tests that pinned the old "whole-cell is one
 * list" detection. Use `splitCellIntoRuns` instead -- it handles
 * cells that mix prose and lists.
 */
export function detectListInCell(
  cellContent: JSONContent[],
): { kind: "bulletList" | "orderedList"; items: string[] } | null {
  const split = splitCellIntoRuns(cellContent);
  if (!split) return null;
  const firstList = split.runs.find((r) => r.kind !== "prose");
  if (!firstList) return null;
  // Only return when the entire cell is one list (the original
  // contract). Mixed cells return null here to match the legacy
  // semantic.
  if (split.runs.length !== 1) return null;
  if (firstList.kind === "bulletList") {
    return { kind: "bulletList", items: firstList.items };
  }
  if (firstList.kind === "orderedList") {
    return { kind: "orderedList", items: firstList.items };
  }
  return null;
}

/**
 * Recursively traverses a Tiptap JSON document and rewrites every
 * list-shaped table cell into a real `bulletList` / `orderedList`.
 *
 * Intended to run immediately after `normalizeTables`:
 *
 *   markdown -> parse() -> normalizeTables() -> normalizeListInCells() -> setContent()
 *
 * so a cell that came from `- a<br/>- b<br/>- c` (or a paste of
 * `- a\n- b\n- c`) becomes a proper list node the user can keep
 * editing as such. Cells that mix prose and list runs become
 * `[paragraph, list]` (or `[list, paragraph]`, etc.).
 *
 * @param node Root node to normalize.
 * @returns A normalized copy of the node tree.
 */
export function normalizeListInCells(node: JSONContent): JSONContent {
  const normalized: JSONContent = { ...node };

  if (normalized.type === "tableCell" || normalized.type === "tableHeader") {
    const cellContent = normalized.content ?? [];
    const split = splitCellIntoRuns(cellContent);
    if (split) {
      normalized.content = runsToCellContent(split.runs);
      return normalized;
    }
  }

  if (normalized.content) {
    normalized.content = normalized.content.map(normalizeListInCells);
  }

  return normalized;
}
