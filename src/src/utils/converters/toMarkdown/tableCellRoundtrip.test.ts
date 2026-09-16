// Regression test for the <br/> in a table cell bug. The U+001F cell-line
// separator must never leak into saved markdown; the <br/> itself must
// survive two parse/render cycles and produce the same markdown both times.

// @vitest-environment jsdom

import "../../../test/setup";

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

import { CustomHardBreak } from "../../../components/Editor/CustomHardBreak";
import { markdownToProsemirror } from "../toProsemirror/markdownToProsemirror";
import { renderWerSuTable } from "./renderTableToMarkdown";

const CELL_LINE_SEPARATOR = "\u001F";

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
