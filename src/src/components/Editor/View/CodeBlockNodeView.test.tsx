// @vitest-environment jsdom

// The code-block node view renders a line-number gutter only in view mode
// (when the editor is not editable). The gutter must appear next to the
// code and disappear as soon as the editor becomes editable again.

import { describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { EditorContent } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { CustomCodeBlock } from "./CustomCodeBlock";
import { lowlight } from "../lowlight";

const createEditor = (content: string) =>
  new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CustomCodeBlock.configure({ lowlight, defaultLanguage: "plaintext" }),
    ],
    content,
  });

// React node views mount through a portal, so a microtask flush is needed
// before the rendered DOM reflects the component.
const flush = () => act(async () => undefined);

describe("CodeBlockNodeView line numbers", () => {
  it("renders one number per code line while in view mode", async () => {
    const editor = createEditor("<pre><code>first\nsecond\nthird</code></pre>");
    render(<EditorContent editor={editor} />);
    try {
      await flush();
      await act(async () => editor.setEditable(false));
      await flush();

      const gutter = editor.view.dom.querySelector("[data-line-numbers]");
      expect(gutter).not.toBeNull();
      expect(
        Array.from(gutter?.querySelectorAll("div") ?? []).map(
          (el) => el.textContent,
        ),
      ).toEqual(["1", "2", "3"]);
    } finally {
      editor.destroy();
    }
  });

  it("hides the gutter while the editor is editable", async () => {
    const editor = createEditor("<pre><code>first\nsecond</code></pre>");
    render(<EditorContent editor={editor} />);
    try {
      await flush();
      await act(async () => editor.setEditable(true));
      await flush();

      expect(editor.view.dom.querySelector("[data-line-numbers]")).toBeNull();
    } finally {
      editor.destroy();
    }
  });
});
