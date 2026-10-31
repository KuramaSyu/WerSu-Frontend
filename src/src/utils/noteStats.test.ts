import { describe, expect, it } from "vitest";
import { Schema, type Node as PMNode } from "@tiptap/pm/model";
import { computeStats } from "./noteStats";

const rows = (node: PMNode): number => computeStats(node).rows;

// Pins the contract the metadata panel relies on:
//   - words == non-whitespace runs, paragraphs kept apart
//   - letters == Unicode letter count (digits/punct don't count)
//   - rows == strategy-based count over the document structure

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: {
      content: "inline*",
      group: "block",
      attrs: { level: { default: 1 } },
    },
    text: { group: "inline" },
    bulletList: { content: "listItem+", group: "block" },
    orderedList: { content: "listItem+", group: "block" },
    listItem: { content: "paragraph block*" },
    taskList: { content: "taskItem+", group: "block" },
    taskItem: { content: "paragraph block*" },
    codeBlock: { content: "text*", group: "block", marks: "" },
    image: { inline: false, group: "block", atom: true },
    table: { content: "tableRow+", group: "block" },
    tableRow: { content: "(tableCell|tableHeader)+" },
    tableCell: { content: "block+" },
    tableHeader: { content: "block+" },
    horizontalRule: { group: "block" },
    blockquote: { content: "block+", group: "block" },
  },
});

const doc = (...content: PMNode[]): PMNode =>
  schema.node("doc", null, content.length ? content : [p()]);

const p = (text?: string): PMNode =>
  schema.node("paragraph", null, text ? schema.text(text) : undefined);

const h = (text: string, level = 1): PMNode =>
  schema.node("heading", { level }, text ? schema.text(text) : undefined);

const li = (...content: PMNode[]): PMNode =>
  schema.node("listItem", null, content);

const bl = (...items: PMNode[]): PMNode =>
  schema.node("bulletList", null, items);

const ol = (...items: PMNode[]): PMNode =>
  schema.node("orderedList", null, items);

const tli = (...content: PMNode[]): PMNode =>
  schema.node("taskItem", null, content);

const tl = (...items: PMNode[]): PMNode =>
  schema.node("taskList", null, items);

const code = (text: string): PMNode =>
  schema.node("codeBlock", null, text ? schema.text(text) : undefined);

const image = (): PMNode => schema.node("image");
const rule = (): PMNode => schema.node("horizontalRule");

const cell = (text: string): PMNode =>
  schema.node("tableCell", null, p(text));
const headerCell = (text: string): PMNode =>
  schema.node("tableHeader", null, p(text));
const row = (...cells: PMNode[]): PMNode =>
  schema.node("tableRow", null, cells);
const table = (...rows: PMNode[]): PMNode =>
  schema.node("table", null, rows);

describe("computeStats", () => {
  it("returns all-zeros for an empty document", () => {
    expect(computeStats(doc())).toEqual({ words: 0, letters: 0, rows: 0 });
  });

  it("counts a single word on one row", () => {
    expect(computeStats(doc(p("hello")))).toEqual({
      words: 1,
      letters: 5,
      rows: 1,
    });
  });

  it("splits on whitespace and ignores empty runs", () => {
    expect(computeStats(doc(p("a  b\tc")))).toEqual({
      words: 3,
      letters: 3,
      rows: 1,
    });
  });

  it("keeps adjacent paragraphs as separate words and rows", () => {
    // Node.textContent would merge these into "helloworld"; the panel
    // must report two words and two rows.
    expect(computeStats(doc(p("hello"), p("world")))).toEqual({
      words: 2,
      letters: 10,
      rows: 2,
    });
  });

  it("ignores blank paragraphs but counts each non-empty one", () => {
    expect(computeStats(doc(p("hello"), p(), p("world")))).toEqual({
      words: 2,
      letters: 10,
      rows: 2,
    });
  });

  it("does not count digits or punctuation as letters", () => {
    expect(computeStats(doc(p("hi 2026!")))).toEqual({
      words: 2,
      letters: 2,
      rows: 1,
    });
  });

  it("counts Unicode letters in the same way as ASCII letters", () => {
    expect(computeStats(doc(p("hëllo wörld")))).toEqual({
      words: 2,
      letters: 10,
      rows: 1,
    });
  });
});

describe("counting strategies", () => {
  it("counts a heading's words, letters and row", () => {
    expect(computeStats(doc(h("Hello World")))).toEqual({
      words: 2,
      letters: 10,
      rows: 1,
    });
  });

  it("counts one row per bullet, including nested items", () => {
    const nested = bl(li(p("a")), li(p("b"), bl(li(p("c")))), li(p("d")));
    expect(rows(doc(nested))).toBe(4);
  });

  it("counts ordered and task lists the same way", () => {
    expect(rows(doc(ol(li(p("a")), li(p("b")))))).toBe(2);
    expect(rows(doc(tl(tli(p("a")), tli(p("b")))))).toBe(2);
  });

  it("counts one row per table row, not per cell or wrapped line", () => {
    const t = table(
      row(headerCell("h1"), headerCell("h2")),
      row(cell("a"), cell("b")),
      row(cell("c"), cell("d")),
    );
    expect(rows(doc(t))).toBe(3);
    // All cells contribute to the table's single text total.
    expect(computeStats(doc(t))).toEqual({
      words: 6,
      letters: 6,
      rows: 3,
    });
  });

  it("counts a code block's words/letters and one row per physical line", () => {
    // words: let, x, return, y
    expect(computeStats(doc(code("let x\nreturn y")))).toEqual({
      words: 4,
      letters: 11,
      rows: 2,
    });
  });

  it("treats an empty code block as zero rows", () => {
    expect(rows(doc(code("")))).toBe(0);
  });

  it("counts an image as one row with no text", () => {
    expect(computeStats(doc(image()))).toEqual({
      words: 0,
      letters: 0,
      rows: 1,
    });
  });

  it("counts an atom block such as a horizontal rule as one row", () => {
    expect(rows(doc(rule()))).toBe(1);
  });

  it("descends into container blocks and counts their children", () => {
    const blockquote = schema.node("blockquote", null, [p("a"), p("b")]);
    expect(rows(doc(blockquote))).toBe(2);
  });

  it("combines strategies across a mixed document", () => {
    const mixed = doc(
      h("Title"),
      p("Intro text"),
      bl(li(p("one")), li(p("two"))),
      image(),
      code("a\nb"),
      table(row(headerCell("h")), row(cell("v"))),
    );
    // heading + paragraph + 2 bullets + image + 2 code lines + 2 table rows
    expect(rows(mixed)).toBe(9);
  });
});
