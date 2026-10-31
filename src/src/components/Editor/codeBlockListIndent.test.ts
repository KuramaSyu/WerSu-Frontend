// Tests for folding a code block into the list directly above it.

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import {
  canIndentCodeBlockIntoList,
  indentCodeBlockIntoList,
} from "./codeBlockListIndent";

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: {} }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
  });
}

/** Places the caret inside the first code block in the document. */
function selectFirstCodeBlock(editor: Editor): void {
  let codePos = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock" && codePos === -1) {
      codePos = pos;
    }
    return true;
  });
  editor.commands.setTextSelection(codePos + 2);
}

/** Finds the code block node plus its parent/index info. */
function findCodeBlock(editor: Editor) {
  let found: {
    parentType: string;
    indexInParent: number;
    parentCount: number;
  } | null = null;
  editor.state.doc.descendants((node, _pos, parent, index) => {
    if (node.type.name === "codeBlock" && !found) {
      found = {
        parentType: parent?.type.name ?? "",
        indexInParent: index,
        parentCount: parent?.childCount ?? 0,
      };
    }
    return true;
  });
  return found;
}

describe("canIndentCodeBlockIntoList", () => {
  it("is true for a code block below a bullet list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p></li><li><p>two</p></li></ul>" +
          "<pre><code>const x = 1</code></pre>",
      );
      selectFirstCodeBlock(editor);
      expect(canIndentCodeBlockIntoList(editor.state)).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("is true for a code block below an ordered list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ol><li><p>one</p></li></ol><pre><code>const x = 1</code></pre>",
      );
      selectFirstCodeBlock(editor);
      expect(canIndentCodeBlockIntoList(editor.state)).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("is true for a code block below a task list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        '<ul data-type="taskList"><li data-type="taskItem"><p>one</p></li></ul>' +
          "<pre><code>const x = 1</code></pre>",
      );
      selectFirstCodeBlock(editor);
      expect(canIndentCodeBlockIntoList(editor.state)).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("is false when the previous sibling is not a list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<p>intro</p><pre><code>const x = 1</code></pre>",
      );
      selectFirstCodeBlock(editor);
      expect(canIndentCodeBlockIntoList(editor.state)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("is false for the first node in the document", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<pre><code>const x = 1</code></pre>");
      selectFirstCodeBlock(editor);
      expect(canIndentCodeBlockIntoList(editor.state)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("is false when the code block is already inside a list item", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p><pre><code>const x = 1</code></pre></li></ul>",
      );
      selectFirstCodeBlock(editor);
      expect(canIndentCodeBlockIntoList(editor.state)).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});

describe("indentCodeBlockIntoList", () => {
  it("appends the block to the last item of the preceding list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p></li><li><p>two</p></li></ul>" +
          "<pre><code>const x = 1</code></pre>",
      );
      selectFirstCodeBlock(editor);

      expect(indentCodeBlockIntoList(editor)).toBe(true);

      const info = findCodeBlock(editor)!;
      // The block now lives in the last list item, as the item's final
      // child (after its paragraph), so the list has not gained an item.
      expect(info.parentType).toBe("listItem");
      expect(info.indexInParent).toBe(1);
      expect(info.parentCount).toBe(2);
      expect(editor.state.doc.firstChild?.type.name).toBe("bulletList");
      expect(editor.state.doc.firstChild?.childCount).toBe(2);
    } finally {
      editor.destroy();
    }
  });

  it("keeps the caret inside the moved code block", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p></li></ul><pre><code>const x = 1</code></pre>",
      );
      selectFirstCodeBlock(editor);
      indentCodeBlockIntoList(editor);

      let ancestor = "";
      const { $from } = editor.state.selection;
      for (let d = $from.depth; d > 0; d -= 1) {
        if ($from.node(d).type.name === "codeBlock") ancestor = "codeBlock";
      }
      expect(ancestor).toBe("codeBlock");
    } finally {
      editor.destroy();
    }
  });

  it("returns false and leaves the document alone when not eligible", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<p>intro</p><pre><code>const x = 1</code></pre>",
      );
      selectFirstCodeBlock(editor);
      const before = editor.getHTML();
      expect(indentCodeBlockIntoList(editor)).toBe(false);
      expect(editor.getHTML()).toBe(before);
    } finally {
      editor.destroy();
    }
  });

  it("round-trips through markdown as an indented fenced block", () => {
    const makeMarkdownEditor = () =>
      new Editor({
        extensions: [
          StarterKit.configure({ codeBlock: {} }),
          Markdown,
        ],
      });

    const editor = makeMarkdownEditor();
    try {
      editor.commands.setContent(
        "- one\n- two\n\n```\nconst x = 1\n```\n",
        { contentType: "markdown" } as never,
      );
      selectFirstCodeBlock(editor);
      expect(indentCodeBlockIntoList(editor)).toBe(true);

      const markdown = editor.getMarkdown();
      // The fence is indented under the last item, so it is part of the
      // enumeration rather than a sibling block.
      expect(markdown).toContain("- two\n  ```\n  const x = 1\n  ```");

      const reparsed = makeMarkdownEditor();
      try {
        reparsed.commands.setContent(markdown, {
          contentType: "markdown",
        } as never);
        expect(reparsed.getHTML()).toBe(editor.getHTML());
      } finally {
        reparsed.destroy();
      }
    } finally {
      editor.destroy();
    }
  });
});
