// Regression guard for LLM-generated markdown that uses `$$...$$` mid-paragraph
// (typically after a `<br/>` inside a list item). The upstream mathematics
// extension only treats `$$...$$` as block math when it starts a standalone
// top-level block; elsewhere its stray `$` characters used to be mispaired with
// the single-`$` inline tokenizer and swallow the surrounding text.
//
// `CustomMathematics` extends the inline tokenizer so `$$...$$` is accepted
// anywhere inline and rendered display-style. Top-level block math is kept.

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

import { CustomMathematics } from "./CustomMathematics";

const editors: Editor[] = [];

function editorWith(markdown: string): Editor {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false, undoRedo: false }),
      CustomMathematics,
      Markdown,
    ],
  });
  editors.push(editor);
  editor.commands.setContent(markdown, { contentType: "markdown" });
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

function collectInlineMath(editor: Editor): string[] {
  const latexes: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "inlineMath") {
      latexes.push(node.attrs.latex as string);
    }
  });
  return latexes;
}

describe("CustomMathematics markdown parsing", () => {
  it("parses `$$...$$` after a <br/> inside a list item as display math", () => {
    const editor = editorWith(
      "1. **Produktregel:**<br/> $$a^m \\cdot a^n = a^{m+n}$$*Beispiel:*$3^2 = 9$",
    );

    const latexes = collectInlineMath(editor);
    expect(latexes).toContain("\\displaystyle a^m \\cdot a^n = a^{m+n}");
    expect(latexes).toContain("3^2 = 9");
    // The label must survive as text, not be swallowed into a math node.
    expect(editor.getText()).toContain("Beispiel:");
    expect(latexes).not.toContain("*Beispiel:*");
  });

  it("keeps plain `$...$` inline math working", () => {
    const editor = editorWith("a $x^2 + y^2$ b");
    expect(collectInlineMath(editor)).toEqual(["x^2 + y^2"]);
  });

  it("still parses a standalone top-level `$$...$$` as block math", () => {
    const editor = editorWith("$$a^m \\cdot a^n$$");
    const first = editor.state.doc.firstChild;
    expect(first?.type.name).toBe("blockMath");
    expect(first?.attrs.latex).toBe("a^m \\cdot a^n");
  });

  it("round-trips display math back to markdown without corruption", () => {
    const editor = editorWith(
      "1. **Quotientenregel:**<br/> $$\\frac{a^m}{a^n} = a^{m-n}$$*Beispiel:*$5^4 = 625$",
    );
    const markdown = editor.getMarkdown();
    expect(markdown).toContain("$\\displaystyle \\frac{a^m}{a^n} = a^{m-n}$");
    expect(markdown).toContain("$5^4 = 625$");
    expect(markdown).toContain("Beispiel:");
  });

  it("handles multiple display formulas with trailing inline examples", () => {
    const editor = editorWith(
      [
        "1. **Regel A:**<br/> $$a^0 = 1$$*Beispiel:*$7^0 = 1$und$7^1 = 7$",
        "2. **Regel B:**<br/> $$a^{-n} = \\frac{1}{a^n}$$*Beispiel:*$2^{-3} = \\frac{1}{8}$",
      ].join("\n"),
    );

    const latexes = collectInlineMath(editor);
    expect(latexes).toEqual([
      "\\displaystyle a^0 = 1",
      "7^0 = 1",
      "7^1 = 7",
      "\\displaystyle a^{-n} = \\frac{1}{a^n}",
      "2^{-3} = \\frac{1}{8}",
    ]);
    expect(editor.getText()).toContain("Beispiel:");
  });
});
