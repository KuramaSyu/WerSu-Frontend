// Tests for pulling a list-nested code block back out of the list.

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import {
  canOutdentCodeBlockFromList,
  findCodeBlockOutdentContext,
  outdentCodeBlockFromList,
} from "./codeBlockListOutdent";
import { indentCodeBlockIntoList } from "./codeBlockListIndent";

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
  let pos = -1;
  editor.state.doc.descendants((node, nodePos) => {
    if (node.type.name === "codeBlock" && pos === -1) pos = nodePos;
    return true;
  });
  editor.commands.setTextSelection(pos + 2);
}

/** Depth of the code block's enclosing list, or -1 when there is none. */
function enclosingListDepth(editor: Editor): number {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === "bulletList" || name === "orderedList" || name === "taskList") {
      return depth;
    }
  }
  return -1;
}

describe("canOutdentCodeBlockFromList", () => {
  it("is true for a code block nested in a bullet list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p></li><li><p>two</p><pre><code>const x = 1</code></pre></li></ul>",
      );
      selectFirstCodeBlock(editor);
      expect(canOutdentCodeBlockFromList(editor.state)).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("is true for a task list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        '<ul data-type="taskList"><li data-type="taskItem"><p>one</p>' +
          "<pre><code>const x = 1</code></pre></li></ul>",
      );
      selectFirstCodeBlock(editor);
      expect(findCodeBlockOutdentContext(editor.state)).not.toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("is false for a top-level code block", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<pre><code>const x = 1</code></pre>");
      selectFirstCodeBlock(editor);
      expect(canOutdentCodeBlockFromList(editor.state)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("is false for a code block that only follows a list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p></li></ul><pre><code>const x = 1</code></pre>",
      );
      selectFirstCodeBlock(editor);
      expect(canOutdentCodeBlockFromList(editor.state)).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});

describe("outdentCodeBlockFromList", () => {
  it("moves the block after the list at the top level", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p></li><li><p>two</p><pre><code>const x = 1</code></pre></li></ul>" +
          "<p></p>",
      );
      selectFirstCodeBlock(editor);

      expect(outdentCodeBlockFromList(editor)).toBe(true);

      // No longer inside the list.
      expect(enclosingListDepth(editor)).toBe(-1);

      const doc = editor.state.doc;
      expect(doc.firstChild?.type.name).toBe("bulletList");
      expect(doc.firstChild?.childCount).toBe(2);
      // The item keeps its paragraph; the block sits right after the list.
      expect(doc.firstChild?.child(1).lastChild?.type.name).toBe("paragraph");
      expect(doc.child(1).type.name).toBe("codeBlock");
      expect(doc.child(1).textContent).toBe("const x = 1");
    } finally {
      editor.destroy();
    }
  });

  it("keeps the caret inside the moved code block", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p><pre><code>const x = 1</code></pre></li></ul>",
      );
      selectFirstCodeBlock(editor);
      outdentCodeBlockFromList(editor);

      const { $from } = editor.state.selection;
      expect($from.parent.type.name).toBe("codeBlock");
      expect($from.node(-1).type.name).toBe("doc");
    } finally {
      editor.destroy();
    }
  });

  it("moves a doubly-nested block out one level", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>outer</p><ul><li><p>inner</p>" +
          "<pre><code>const x = 1</code></pre></li></ul></li></ul>",
      );
      selectFirstCodeBlock(editor);
      expect(outdentCodeBlockFromList(editor)).toBe(true);

      // Back inside the outer list item, but after the nested list.
      const { $from } = editor.state.selection;
      expect($from.parent.type.name).toBe("codeBlock");
      expect($from.node(-1).type.name).toBe("listItem");
      // The nested list is now empty of the block and still present.
      expect($from.node(-2).type.name).toBe("bulletList");
    } finally {
      editor.destroy();
    }
  });

  it("is a no-op when the block is not in a list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<pre><code>const x = 1</code></pre>");
      selectFirstCodeBlock(editor);
      const before = editor.getHTML();
      expect(outdentCodeBlockFromList(editor)).toBe(false);
      expect(editor.getHTML()).toBe(before);
    } finally {
      editor.destroy();
    }
  });

  it("round-trips with indent: list + block -> in list -> after list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p></li></ul><pre><code>const x = 1</code></pre>",
      );
      selectFirstCodeBlock(editor);
      const original = editor.getHTML();

      expect(indentCodeBlockIntoList(editor)).toBe(true);
      expect(canOutdentCodeBlockFromList(editor.state)).toBe(true);

      expect(outdentCodeBlockFromList(editor)).toBe(true);
      expect(editor.getHTML()).toBe(original);
    } finally {
      editor.destroy();
    }
  });
});
