// Regression test: lists inside a table cell serialize as <br/> linebreaks,
// not whitespace-collapsed prose. Names below come from a 1998 manga.

// @vitest-environment jsdom

import "../../../test/setup";

import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list";

import { CustomHardBreak } from "../../../components/Editor/CustomHardBreak";
import { renderWerSuTable } from "../toMarkdown/renderTableToMarkdown";
import { markdownToProsemirror } from "./markdownToProsemirror";

// Stub: TableControlls.tsx drags in MUI via ReactNodeViewRenderer, so
// the production extension cannot be imported here. The renderMarkdown
// function it points at is the same one the production code uses.

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
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      // CustomHardBreak is required so the Markdown parser recognises
      // `<br/>` as a hardBreak node when round-tripping cell content.
      CustomHardBreak,
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

function cellListNode(spec: ListSpec): JSONContent {
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
  firstCell: JSONContent,
  secondCellText: string,
): JSONContent {
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
