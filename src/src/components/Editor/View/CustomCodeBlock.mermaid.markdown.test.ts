// Storage-contract guard for Mermaid blocks.
//
// Mermaid is deliberately *not* a node type: a diagram is a regular
// `codeBlock` node with `language: "mermaid"`, so markdown storage is a plain
// fenced code block. These tests pin that contract down in both directions
// and make sure `CustomCodeBlock`'s language canonicalization (bare fence ->
// "plaintext") never strips the mermaid tag.

// @vitest-environment jsdom

import "../../../test/setup";

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

import { lowlight } from "../lowlight";
import { CustomCodeBlock } from "./CustomCodeBlock";

const MERMAID_BODY = "flowchart TD\n    A --> B";
const MERMAID_FENCE = ["```mermaid", MERMAID_BODY, "```"].join("\n");

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false, undoRedo: false }),
      CustomCodeBlock.configure({ lowlight, defaultLanguage: "plaintext" }),
      Markdown,
    ],
  });
}

const editors: Editor[] = [];
function editorWith(markdown: string): Editor {
  const editor = makeEditor();
  editors.push(editor);
  editor.commands.setContent(markdown, { contentType: "markdown" });
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe("CustomCodeBlock mermaid markdown round-trip", () => {
  it("parses a mermaid fence into a single codeBlock with the mermaid tag", () => {
    const editor = editorWith(MERMAID_FENCE);
    // The markdown parser appends a trailing empty paragraph, so filter to
    // the code blocks instead of asserting on the whole child count.
    const blocks: { attrs: Record<string, unknown>; text: string }[] = [];
    editor.state.doc.forEach((node) => {
      if (node.type.name !== "codeBlock") return;
      blocks.push({ attrs: node.attrs, text: node.textContent });
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].attrs.language).toBe("mermaid");
    expect(blocks[0].text).toContain("flowchart TD");
    expect(blocks[0].text).toContain("A --> B");
  });

  it("writes the diagram back as a fenced mermaid block", () => {
    const markdown = editorWith(MERMAID_FENCE).getMarkdown();
    expect(markdown).toContain("```mermaid");
    expect(markdown).toContain("flowchart TD");
    expect(markdown).toContain("A --> B");
  });

  it("does not downgrade a mermaid fence to plaintext", () => {
    const editor = editorWith(MERMAID_FENCE);
    // `renderMarkdown` drops only the "plaintext" tag, so the mermaid tag
    // must survive both the parse and the writeback.
    expect(editor.state.doc.firstChild?.attrs.language).toBe("mermaid");
    expect(editor.getMarkdown()).not.toBe("```\n" + MERMAID_BODY + "\n```");
  });

  it("is stable across a second round-trip", () => {
    const once = editorWith(MERMAID_FENCE).getMarkdown();
    expect(editorWith(once).getMarkdown()).toBe(once);
  });

  it("keeps a javascript tag and leaves a bare fence as plaintext", () => {
    const javascriptEditor = editorWith("```javascript\nconst a = 1;\n```");
    expect(javascriptEditor.state.doc.firstChild?.attrs.language).toBe(
      "javascript",
    );
    expect(javascriptEditor.getMarkdown()).toContain("```javascript");

    const bareEditor = editorWith("```\nplain text\n```");
    expect(bareEditor.state.doc.firstChild?.attrs.language).toBe("plaintext");
    // A bare fence stays bare rather than gaining a "plaintext" tag.
    expect(bareEditor.getMarkdown()).not.toContain("```plaintext");
  });
});