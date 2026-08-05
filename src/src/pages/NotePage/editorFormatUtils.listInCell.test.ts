// Regression test: lists inside a table cell serialize as `<br/>`
// linebreaks, not whitespace-collapsed prose.
//
// `extension-table@3.26.x`'s stock `renderTableToMarkdown` runs
// `collapseWhitespace` on each cell, which collapses the `\n` that
// `BulletList.renderMarkdown` uses to separate items into a single
// space. So `- a / - b / - c` inside a rich cell would silently
// become `- a - b - c` on every save. The production fix in
// `TableControlls.tsx` re-implements the cell layout and preserves
// line breaks as `<br/>` instead.
//
// We don't import `TableWithControls` directly because it pulls in
// MUI via `ReactNodeViewRenderer` (see CustomHtml.test.ts for the
// same workaround). Instead we mirror the override inline.
//
// Names below come from Hunter × Hunter (Togashi, 1998-).

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
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list";

import { markdownToProsemirror } from "./editorFormatUtils";

// Mirror of the production override on `TableWithControls.renderMarkdown`
// in `src/components/Editor/TableControlls/TableControlls.tsx`. Kept in
// sync with that override. See the helper definitions there for the
// rationale (line-break preservation in cells).
//
// Uses `h.renderChild` rather than `h.renderChildren`: `renderChildren`
// flattens a node's `.content` into siblings with the parent's separator,
// which silently drops the list's own `\n`-separator logic when the cell
// only holds a single block-level child like a `bulletList`. `renderChild`
// routes through the child's own `renderMarkdown` instead.
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
  renderMarkdown: (node, h) => {
    return renderWerSuTable(node as never, h as never);
  },
});

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        undoRedo: false,
        hardBreak: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      BulletList,
      ListItem,
      OrderedList,
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

type Item = { text: string };
type ListSpec =
  | { kind: "bulletList"; items: Item[] }
  | { kind: "orderedList"; items: Item[]; start?: number };

function cellListNode(spec: ListSpec) {
  if (spec.kind === "bulletList") {
    return {
      type: "bulletList",
      content: spec.items.map((item) => ({
        type: "listItem",
        content: [
          { type: "paragraph", content: [{ type: "text", text: item.text }] },
        ],
      })),
    };
  }
  return {
    type: "orderedList",
    attrs: { start: spec.start ?? 1 },
    content: spec.items.map((item) => ({
      type: "listItem",
      content: [
        { type: "paragraph", content: [{ type: "text", text: item.text }] },
      ],
    })),
  };
}

function makeTableDoc(
  firstCell: { type: string; content: unknown[] },
  secondCellText: string,
) {
  return {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableHeader",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Hunter" }],
                  },
                ],
              },
              {
                type: "tableHeader",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Nen" }],
                  },
                ],
              },
            ],
          },
          {
            type: "tableRow",
            content: [
              firstCell,
              {
                type: "tableCell",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: secondCellText }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("lists in table cells serialize as <br/> linebreaks", () => {
  it("Gon, Killua, and Kurapika show up as a bullet list in a cell", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      makeTableDoc(
        {
          type: "tableCell",
          content: [
            cellListNode({
              kind: "bulletList",
              items: [
                { text: "Gon Freecss" },
                { text: "Killua Zoldyck" },
                { text: "Kurapika" },
              ],
            }),
          ],
        },
        "Enhancement",
      ),
    );

    const md = editor.getMarkdown();
    const lines = md
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|") && !l.startsWith("| ---"));

    // The data row carries the three hunters, joined by `<br/>` so the
    // markdown source keeps the line breaks that the rich editor had.
    const dataRow = lines[lines.length - 1];
    expect(dataRow).toContain(
      "- Gon Freecss<br/>- Killua Zoldyck<br/>- Kurapika",
    );
    // The list must not have been whitespace-collapsed into a single line.
    expect(dataRow).not.toContain("- Gon Freecss - Killua Zoldyck");
  });

  it("Leorio, Hisoka, and Chrollo show up as an ordered list in a cell", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      makeTableDoc(
        {
          type: "tableCell",
          content: [
            cellListNode({
              kind: "orderedList",
              start: 1,
              items: [
                { text: "Leorio Paradinight" },
                { text: "Hisoka Morow" },
                { text: "Chrollo Lucilfer" },
              ],
            }),
          ],
        },
        "Transmutation",
      ),
    );

    const md = editor.getMarkdown();
    const lines = md
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|") && !l.startsWith("| ---"));

    const dataRow = lines[lines.length - 1];
    expect(dataRow).toContain(
      "1. Leorio Paradinight<br/>2. Hisoka Morow<br/>3. Chrollo Lucilfer",
    );
    expect(dataRow).not.toContain(
      "1. Leorio Paradinight 2. Hisoka Morow 3. Chrollo Lucilfer",
    );
  });

  it("the cell survives a markdownToProsemirror round-trip (no drift)", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      makeTableDoc(
        {
          type: "tableCell",
          content: [
            cellListNode({
              kind: "bulletList",
              items: [
                { text: "Feitan Portor" },
                { text: "Machi Komacine" },
                { text: "Phinks Magcub" },
              ],
            }),
          ],
        },
        "Meteor City",
      ),
    );

    const md1 = editor.getMarkdown();
    const doc2 = markdownToProsemirror(editor, md1);
    editor.commands.setContent(doc2);
    const md2 = editor.getMarkdown();

    expect(md2).toBe(md1);
    expect(md2).toContain(
      "- Feitan Portor<br/>- Machi Komacine<br/>- Phinks Magcub",
    );
  });
});
