// Regression test: a table cell whose markdown source looks like a list
// is rewritten into a real bulletList / orderedList node. Names below
// come from a 1998 manga.

// @vitest-environment jsdom

import "../../../test/setup";

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";

import { CustomHardBreak } from "../../../components/Editor/CustomHardBreak";
import {
  detectListInCell,
  rewriteCellAsList,
  splitCellIntoRuns,
  type Run,
} from "../../../components/Editor/jsonNormalization";
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

type DocNode = {
  type?: string;
  text?: string;
  content?: DocNode[];
};

describe("detectListInCell (pure)", () => {
  it("detects a single-paragraph `<br/>`-separated bullet list", () => {
    const cellContent = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "- Gon" },
          { type: "hardBreak" },
          { type: "text", text: "- Killua" },
          { type: "hardBreak" },
          { type: "text", text: "- Kurapika" },
        ],
      },
    ];
    expect(detectListInCell(cellContent)).toEqual({
      kind: "bulletList",
      items: ["Gon", "Killua", "Kurapika"],
    });
  });

  it("detects a multi-paragraph bullet list (paste shape)", () => {
    const cellContent = [
      { type: "paragraph", content: [{ type: "text", text: "- Gon" }] },
      { type: "paragraph", content: [{ type: "text", text: "- Killua" }] },
      { type: "paragraph", content: [{ type: "text", text: "- Kurapika" }] },
    ];
    expect(detectListInCell(cellContent)).toEqual({
      kind: "bulletList",
      items: ["Gon", "Killua", "Kurapika"],
    });
  });

  it("detects an ordered list", () => {
    const cellContent = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "1. Leorio" },
          { type: "hardBreak" },
          { type: "text", text: "2. Hisoka" },
          { type: "hardBreak" },
          { type: "text", text: "3. Chrollo" },
        ],
      },
    ];
    expect(detectListInCell(cellContent)).toEqual({
      kind: "orderedList",
      items: ["Leorio", "Hisoka", "Chrollo"],
    });
  });

  it("rejects non-list paragraph content", () => {
    const cellContent = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "just prose" }],
      },
    ];
    expect(detectListInCell(cellContent)).toBeNull();
  });

  it("rejects a single item (no list yet)", () => {
    expect(
      detectListInCell([
        {
          type: "paragraph",
          content: [{ type: "text", text: "- solo" }],
        },
      ]),
    ).toBeNull();
  });
});

describe("rewriteCellAsList (pure)", () => {
  it("rewrites a bullet cell into a bulletList", () => {
    const cellContent = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "- Feitan" },
          { type: "hardBreak" },
          { type: "text", text: "- Machi" },
        ],
      },
    ];
    const out = rewriteCellAsList(cellContent);
    expect(out).toEqual([
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Feitan" }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Machi" }] },
            ],
          },
        ],
      },
    ]);
  });
});

describe("markdownToProsemirror list normaliser (end-to-end)", () => {
  it("rewrites a <br/>-separated bullet cell into a bulletList", () => {
    const editor = freshEditor();
    const md = [
      "| a | b |",
      "| --- | --- |",
      "| - Gon<br/>- Killua<br/>- Kurapika | x |",
      "",
    ].join("\n");
    const doc = markdownToProsemirror(editor, md);
    const cell = doc.content?.[0].content?.[1].content?.[0];
    expect(cell?.type).toBe("tableCell");
    expect(cell?.content?.[0].type).toBe("bulletList");
    const items = (cell?.content?.[0].content ?? []) as Array<{
      content: Array<{ content: Array<{ text: string }> }>;
    }>;
    expect(items.map((i) => i.content[0].content[0].text)).toEqual([
      "Gon",
      "Killua",
      "Kurapika",
    ]);
  });

  it("rewrites a <br/>-separated ordered cell into an orderedList", () => {
    const editor = freshEditor();
    const md = [
      "| a | b |",
      "| --- | --- |",
      "| 1. Leorio<br/>2. Hisoka<br/>3. Chrollo | x |",
      "",
    ].join("\n");
    const doc = markdownToProsemirror(editor, md);
    const cell = doc.content?.[0].content?.[1].content?.[0];
    expect(cell?.content?.[0].type).toBe("orderedList");
    const items = (cell?.content?.[0].content ?? []) as Array<{
      content: Array<{ content: Array<{ text: string }> }>;
    }>;
    expect(items.map((i) => i.content[0].content[0].text)).toEqual([
      "Leorio",
      "Hisoka",
      "Chrollo",
    ]);
  });

  it("rewrites a multi-paragraph bullet cell (paste shape) into a bulletList", () => {
    const editor = freshEditor();
    // The plain-text paste shape: each line became its own paragraph in
    // the cell. The normaliser should still recognise it as a bulletList.
    const seed = {
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
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "- Illumi" }],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "- Hisoka" }],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "- Silva" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Zoldyck" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    editor.commands.setContent(seed);
    const md = editor.getMarkdown();
    const doc2 = markdownToProsemirror(editor, md);
    const cell = doc2.content?.[0].content?.[1].content?.[0];
    expect(cell?.content?.[0].type).toBe("bulletList");
    const items = (cell?.content?.[0].content ?? []) as Array<{
      content: Array<{ content: Array<{ text: string }> }>;
    }>;
    expect(items.map((i) => i.content[0].content[0].text)).toEqual([
      "Illumi",
      "Hisoka",
      "Silva",
    ]);
  });

  it("leaves a plain-prose cell alone", () => {
    const editor = freshEditor();
    const md = ["| a | b |", "| --- | --- |", "| just prose | x |", ""].join(
      "\n",
    );
    const doc = markdownToProsemirror(editor, md);
    const cell = doc.content?.[0].content?.[1].content?.[0];
    expect(cell?.content?.[0].type).toBe("paragraph");
  });

  it("round-trips a bulletList: list -> markdown -> list (no drift)", () => {
    const editor = freshEditor();
    // Seed the editor with a real bulletList node (the rich-cell state).
    const seed = {
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
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "bulletList",
                      content: [
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "Feitan" }],
                            },
                          ],
                        },
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "Machi" }],
                            },
                          ],
                        },
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "Phinks" }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Meteor City" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    editor.commands.setContent(seed);
    const md1 = editor.getMarkdown();

    // Re-parse the markdown the same way the store does.
    const doc2 = markdownToProsemirror(editor, md1);
    editor.commands.setContent(doc2);
    const md2 = editor.getMarkdown();

    // No drift between the two markdown round-trips.
    expect(md2).toBe(md1);

    // And the parsed JSON is still a real bulletList, not flattened prose.
    const json = editor.getJSON() as unknown as DocNode;
    const cell = json.content?.[0].content?.[1].content?.[0];
    expect(cell?.content?.[0].type).toBe("bulletList");
    const items = cell?.content?.[0].content ?? [];
    expect(items.map((i) => i.content?.[0].content?.[0].text)).toEqual([
      "Feitan",
      "Machi",
      "Phinks",
    ]);
  });

  it("round-trips an orderedList: list -> markdown -> list (no drift)", () => {
    const editor = freshEditor();
    const seed = {
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
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "orderedList",
                      attrs: { start: 1 },
                      content: [
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "Netero" }],
                            },
                          ],
                        },
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "Zeno" }],
                            },
                          ],
                        },
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "Silva" }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Zodiacs" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    editor.commands.setContent(seed);
    const md1 = editor.getMarkdown();

    const doc2 = markdownToProsemirror(editor, md1);
    editor.commands.setContent(doc2);
    const md2 = editor.getMarkdown();

    expect(md2).toBe(md1);

    const json = editor.getJSON() as unknown as DocNode;
    const cell = json.content?.[0].content?.[1].content?.[0];
    expect(cell?.content?.[0].type).toBe("orderedList");
    const items = cell?.content?.[0].content ?? [];
    expect(items.map((i) => i.content?.[0].content?.[0].text)).toEqual([
      "Netero",
      "Zeno",
      "Silva",
    ]);
  });
});

describe("splitCellIntoRuns (pure)", () => {
  it("returns [paragraph, orderedList] for a prose-then-list cell", () => {
    const cellContent = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "asdfsdf" },
          { type: "hardBreak" },
          { type: "text", text: "1. a" },
          { type: "hardBreak" },
          { type: "text", text: "2. b" },
          { type: "hardBreak" },
          { type: "text", text: "3. c" },
        ],
      },
    ];
    const split = splitCellIntoRuns(cellContent);
    expect(split?.runs).toEqual<Run[]>([
      { kind: "prose", lines: ["asdfsdf"] },
      { kind: "orderedList", start: 1, items: ["a", "b", "c"] },
    ]);
  });

  it("returns [orderedList, paragraph] for a list-then-prose cell", () => {
    const cellContent = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "1. first" },
          { type: "hardBreak" },
          { type: "text", text: "2. second" },
          { type: "hardBreak" },
          { type: "text", text: "tail prose" },
        ],
      },
    ];
    const split = splitCellIntoRuns(cellContent);
    expect(split?.runs).toEqual<Run[]>([
      { kind: "orderedList", start: 1, items: ["first", "second"] },
      { kind: "prose", lines: ["tail prose"] },
    ]);
  });

  it("returns [paragraph, bulletList, paragraph] for prose/list/prose", () => {
    const cellContent = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "head" },
          { type: "hardBreak" },
          { type: "text", text: "- a" },
          { type: "hardBreak" },
          { type: "text", text: "- b" },
          { type: "hardBreak" },
          { type: "text", text: "tail" },
        ],
      },
    ];
    const split = splitCellIntoRuns(cellContent);
    expect(split?.runs).toEqual<Run[]>([
      { kind: "prose", lines: ["head"] },
      { kind: "bulletList", marker: "-", items: ["a", "b"] },
      { kind: "prose", lines: ["tail"] },
    ]);
  });

  it("returns null when no list runs exist", () => {
    const cellContent = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "just prose" }],
      },
    ];
    expect(splitCellIntoRuns(cellContent)).toBeNull();
  });
});

describe("markdownToProsemirror mixed prose + list normaliser (end-to-end)", () => {
  it("renders a paragraph and an orderedList into a single cell", () => {
    const editor = freshEditor();
    const md = [
      "| a | b |",
      "| --- | --- |",
      "| asdfsdf<br/>1. a<br/>2. b<br/>3. c | x |",
      "",
    ].join("\n");
    const doc = markdownToProsemirror(editor, md);
    const cell = doc.content?.[0].content?.[1].content?.[0];
    expect(cell?.type).toBe("tableCell");
    // First child: a prose paragraph containing "asdfsdf".
    expect(cell?.content?.[0].type).toBe("paragraph");
    const firstParaText = (
      cell?.content?.[0] as { content?: Array<{ text: string }> }
    ).content?.[0]?.text;
    expect(firstParaText).toBe("asdfsdf");
    // Second child: a real orderedList.
    expect(cell?.content?.[1].type).toBe("orderedList");
    const items = (cell?.content?.[1].content ?? []) as Array<{
      content: Array<{ content: Array<{ text: string }> }>;
    }>;
    expect(items.map((i) => i.content[0].content[0].text)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("round-trips a paragraph + orderedList cell (no drift)", () => {
    const editor = freshEditor();
    // Seed: cell with a paragraph followed by an ordered list.
    const seed = {
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
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "intro" }],
                    },
                    {
                      type: "orderedList",
                      attrs: { start: 1 },
                      content: [
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "x" }],
                            },
                          ],
                        },
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "y" }],
                            },
                          ],
                        },
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "z" }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Zoldyck" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    editor.commands.setContent(seed);
    const md1 = editor.getMarkdown();

    const doc2 = markdownToProsemirror(editor, md1);
    editor.commands.setContent(doc2);
    const md2 = editor.getMarkdown();

    expect(md2).toBe(md1);

    const json = editor.getJSON() as unknown as DocNode;
    const cell = json.content?.[0].content?.[1].content?.[0];
    expect(cell?.content?.[0].type).toBe("paragraph");
    expect(cell?.content?.[1].type).toBe("orderedList");
  });
});
