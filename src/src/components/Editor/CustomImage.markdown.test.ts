// Round-trip guard for sized images: a `style` attribute must survive
// markdown -> ProseMirror -> markdown in both directions so resizing an
// image never corrupts the note source.

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

import { CustomImage } from "./View/CustomImage";

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false, undoRedo: false }),
      CustomImage,
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

describe("CustomImage markdown round-trip", () => {
  it("keeps a plain markdown image as markdown", () => {
    const editor = editorWith("![alt](http://x/a.png)");
    expect(editor.getMarkdown()).toContain("![alt](http://x/a.png)");
  });

  it("renders a sized image as an <img> HTML block", () => {
    const editor = editorWith(
      '<img src="http://x/a.png" alt="alt" style="width: 320px; height: auto"/>',
    );
    const markdown = editor.getMarkdown();
    expect(markdown).toContain("<img");
    expect(markdown).toContain('style="width: 320px; height: auto"');
    expect(markdown).not.toContain("![alt]");
  });

  it("emits plain markdown for a full-width (100%) image", () => {
    const editor = editorWith(
      '<img src="http://x/a.png" alt="alt" style="width: 100%; height: auto"/>',
    );
    const markdown = editor.getMarkdown();
    expect(markdown).toContain("![alt](http://x/a.png)");
    expect(markdown).not.toContain("<img");
  });

  it("keeps the HTML block when 100% is combined with a real height", () => {
    const editor = editorWith(
      '<img src="http://x/a.png" alt="alt" style="width: 100%; height: 180px"/>',
    );
    const markdown = editor.getMarkdown();
    expect(markdown).toContain("<img");
    expect(markdown).toContain("height: 180px");
  });

  it("parses an <img> HTML block back into a style attribute", () => {
    const editor = editorWith(
      '<img src="http://x/a.png" alt="alt" style="width: 50%; height: auto"/>',
    );
    const image = editor.state.doc.firstChild;
    expect(image?.type.name).toBe("image");
    expect(image?.attrs.style).toBe("width: 50%; height: auto");
  });

  it("is stable across a second round-trip", () => {
    const editor = editorWith(
      '<img src="http://x/a.png" alt="alt" style="width: 320px; height: auto"/>',
    );
    const once = editor.getMarkdown();
    const second = editorWith(once).getMarkdown();
    expect(second).toBe(once);
  });

  it("drops the HTML block again when the width is cleared", () => {
    const editor = editorWith(
      '<img src="http://x/a.png" alt="alt" style="width: 320px; height: auto"/>',
    );
    editor.commands.updateAttributes("image", { style: "" });
    expect(editor.getMarkdown()).toContain("![alt](http://x/a.png)");
    expect(editor.getMarkdown()).not.toContain("<img");
  });
});
