// Regression test for the <br/> in a table cell bug.
//
// When a note with `<br/>` inside a table cell goes through
// `markdownToProsemirror` (the path `useActiveNoteStore.setContent`
// uses on every load), the cell content round-tripped back to
// markdown used to leak the raw U+001F (Unit Separator) cell-line
// separator from `extension-table@3.26.x` into the cell text. That
// control char shows up as the replacement character (`\uFFFD`) in
// the editor, corrupting the cell on every save / reload.
//
// The production fix replaces `Table.renderMarkdown` with a custom
// implementation that re-implements the cell layout so it can preserve
// line breaks as `<br/>` instead of collapsing them. The stock
// `extension-table@3.26.x` renderer collapses all whitespace in cells
// (`- a - b - c`), so cell content with real line structure (a `<br/>`,
// a list inside a cell, multiple paragraphs) would silently lose that
// structure on every save.
//
// We don't import `TableWithControls` directly because it pulls in MUI
// via `ReactNodeViewRenderer` and the existing jsdom test setup rejects
// that ESM resolution (see CustomHtml.test.ts for the same workaround).
// Instead, we apply the same `renderMarkdown` override inline here so
// the fix logic is exercised end-to-end.

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";

import { CustomHardBreak } from "../../components/Editor/CustomHardBreak";
import { markdownToProsemirror } from "./editorFormatUtils";

const CELL_LINE_SEPARATOR = "\u001F";

// Mirror of the production override on `TableWithControls.renderMarkdown`
// in `src/components/Editor/TableControlls/TableControlls.tsx`. Kept in
// sync with that override. See the helper definitions there for the
// rationale (line-break preservation in cells).
//
// Uses `h.renderChild` rather than `h.renderChildren`: `renderChildren`
// flattens a node's `.content` into siblings with the parent's separator,
// which silently drops a list's own `\n`-separator logic when the cell
// only holds a single block-level child. `renderChild` routes through the
// child's own `renderMarkdown` instead.
function assembleCellText(
  h: { renderChild: (n: unknown, i: number) => string },
  content: unknown,
): string {
  const children = Array.isArray(content) ? content : content ? [content] : [];
  if (children.length === 0) return "";
  // Render each block-level child of the cell. A child may itself be a
  // multi-line structure (a bullet list, ordered list, multiple
  // paragraphs, ...). Split its rendered output on newline so each
  // logical line becomes a separate "<br/>"-joined cell line.
  const lines: string[] = [];
  for (let i = 0; i < children.length; i += 1) {
    const raw = h.renderChild(children[i], i);
    for (const part of raw.split(/\r?\n/)) {
      const cleaned = part.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
      if (cleaned.length > 0) lines.push(cleaned);
    }
  }
  return lines.join("<br/>");
}

function renderWerSuTable(
  node: {
    content?: Array<{
      content?: Array<{
        type: string;
        attrs?: Record<string, unknown>;
        content?: unknown;
      }>;
    }> | null;
  },
  h: { renderChild?: (n: unknown, i: number) => string },
): string {
  if (!node.content || node.content.length === 0) return "";
  type Row = { text: string; isHeader: boolean }[];
  const rows: Row[] = [];
  for (const rowNode of node.content) {
    const cells: Row = [];
    if (rowNode.content) {
      for (const cellNode of rowNode.content) {
        cells.push({
          text: assembleCellText(
            { renderChild: h.renderChild ?? (() => "") },
            cellNode.content,
          ),
          isHeader: cellNode.type === "tableHeader",
        });
      }
    }
    rows.push(cells);
  }
  const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  if (columnCount === 0) return "";
  const colWidths: number[] = new Array(columnCount).fill(0);
  for (const r of rows) {
    for (let i = 0; i < columnCount; i += 1) {
      const t = r[i]?.text || "";
      colWidths[i] = Math.max(colWidths[i], t.length, 3);
    }
  }
  const pad = (s: string, w: number) =>
    s + " ".repeat(Math.max(0, w - s.length));
  const headerRow = rows[0];
  const hasHeader = headerRow.some((c) => c.isHeader);
  let out = "\n";
  const headerTexts = new Array(columnCount)
    .fill(0)
    .map((_, i) => (hasHeader ? headerRow[i]?.text || "" : ""));
  out += `| ${headerTexts.map((t, i) => pad(t, colWidths[i])).join(" | ")} |\n`;
  out += `| ${colWidths.map((w) => "-".repeat(Math.max(3, w))).join(" | ")} |\n`;
  const body = hasHeader ? rows.slice(1) : rows;
  for (const r of body) {
    out += `| ${new Array(columnCount)
      .fill(0)
      .map((_, i) => pad(r[i]?.text || "", colWidths[i]))
      .join(" | ")} |\n`;
  }
  return out;
}

const TableCustom = Table.extend({
  renderMarkdown: (node, h) => renderWerSuTable(node as never, h as never),
});

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        undoRedo: false,
        hardBreak: false,
      }),
      CustomHardBreak,
      TableCustom,
      TableRow,
      TableCell,
      TableHeader,
      Markdown,
    ],
  });
}

const editors: Editor[] = [];

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

function freshEditor(): Editor {
  const e = makeEditor();
  editors.push(e);
  return e;
}

describe("markdownToProsemirror + Table.renderMarkdown round-trip", () => {
  it("keeps a <br/> in a cell across two rich -> markdown -> rich cycles", () => {
    const editor = freshEditor();
    const mdIn = [
      "| a | b |",
      "| --- | --- |",
      "| line one<br/>line two | x |",
      "",
    ].join("\n");

    // First load: parses + normalizes via markdownToProsemirror, then we
    // set it into the editor to mirror the live `setContent` path.
    const doc1 = markdownToProsemirror(editor, mdIn);
    editor.commands.setContent(doc1);

    const md1 = editor.getMarkdown();

    // Second load: re-run the same path the editor store uses.
    const doc2 = markdownToProsemirror(editor, md1);
    editor.commands.setContent(doc2);

    const md2 = editor.getMarkdown();

    // The U+001F cell-line separator must never leak into the saved
    // markdown. That is the visible-`\uFFFD` symptom the user reported.
    expect(md1).not.toContain(CELL_LINE_SEPARATOR);
    expect(md2).not.toContain(CELL_LINE_SEPARATOR);

    // The `<br/>` itself must survive both round-trips.
    expect(md1.replace(/\s+/g, " ")).toContain("line one<br/>line two");
    expect(md2.replace(/\s+/g, " ")).toContain("line one<br/>line two");

    // The second round-trip must match the first -- otherwise the cell
    // keeps drifting every save.
    expect(md2).toBe(md1);
  });
});
