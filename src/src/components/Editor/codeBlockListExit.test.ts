// Tests for leaving a list-nested code block with Enter.

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { CustomCodeBlock } from "./View/CustomCodeBlock";
import { lowlight } from "./lowlight";
import {
  canExitCodeBlockToList,
  exitCodeBlockToList,
  findCodeBlockListExitContext,
} from "./codeBlockListExit";

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CustomCodeBlock.configure({ lowlight, defaultLanguage: "plaintext" }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
  });
}

/** Builds a bullet list whose last item ends with a code block. */
function setListWithCode(
  editor: Editor,
  codeText: string,
  options: { itemCount?: number; task?: boolean } = {},
): void {
  const itemCount = options.itemCount ?? 2;
  const items = Array.from({ length: itemCount }, (_, index) => ({
    type: options.task ? "taskItem" : "listItem",
    attrs: options.task ? { checked: false } : undefined,
    content: [{ type: "paragraph", content: [{ type: "text", text: `item ${index + 1}` }] }],
  }));
  items[items.length - 1].content.push({
    type: "codeBlock",
    attrs: { language: "plaintext" },
    content: codeText.length ? [{ type: "text", text: codeText }] : [],
  } as never);

  editor.commands.setContent({
    type: "doc",
    content: [
      {
        type: options.task ? "taskList" : "bulletList",
        content: items,
      },
      { type: "paragraph" },
    ],
  } as never);
}

/** Places the caret at the end of the first code block. */
function selectCodeBlockEnd(editor: Editor): void {
  let end = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock") end = pos + node.nodeSize - 1;
    return true;
  });
  editor.commands.setTextSelection(end);
}

function pressEnter(editor: Editor): void {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe("findCodeBlockListExitContext", () => {
  it("matches a code block at the end of a list item with a blank line", () => {
    const editor = makeEditor();
    try {
      setListWithCode(editor, "line1\n");
      selectCodeBlockEnd(editor);
      expect(canExitCodeBlockToList(editor.state)).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("matches an empty code block at the end of a list item", () => {
    const editor = makeEditor();
    try {
      setListWithCode(editor, "");
      selectCodeBlockEnd(editor);
      expect(findCodeBlockListExitContext(editor.state)).not.toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("does not match while the caret is mid-line", () => {
    const editor = makeEditor();
    try {
      setListWithCode(editor, "line1\n");
      let start = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "codeBlock") start = pos + 1;
        return true;
      });
      editor.commands.setTextSelection(start + 2);
      expect(canExitCodeBlockToList(editor.state)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("does not match when the code block is not the last child", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><pre><code>line1\n</code></pre><p>after</p></li></ul>",
      );
      selectCodeBlockEnd(editor);
      expect(canExitCodeBlockToList(editor.state)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("does not match a top-level code block", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<pre><code>line1\n</code></pre>");
      selectCodeBlockEnd(editor);
      expect(canExitCodeBlockToList(editor.state)).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});

describe("exitCodeBlockToList", () => {
  it("appends a new item at the same level and drops the blank line", () => {
    const editor = makeEditor();
    try {
      setListWithCode(editor, "line1\n");
      selectCodeBlockEnd(editor);

      expect(exitCodeBlockToList(editor)).toBe(true);

      const list = editor.state.doc.firstChild!;
      expect(list.type.name).toBe("bulletList");
      // Two items became three, with the code block still inside item 2.
      expect(list.childCount).toBe(3);
      expect(list.child(1).lastChild?.type.name).toBe("codeBlock");
      expect(list.child(1).lastChild?.textContent).toBe("line1");
      expect(list.child(2).textContent).toBe("");
    } finally {
      editor.destroy();
    }
  });

  it("keeps the caret in the new list item", () => {
    const editor = makeEditor();
    try {
      setListWithCode(editor, "line1\n");
      selectCodeBlockEnd(editor);
      exitCodeBlockToList(editor);

      const { $from } = editor.state.selection;
      expect($from.parent.type.name).toBe("paragraph");
      expect($from.node(-1).type.name).toBe("listItem");
    } finally {
      editor.destroy();
    }
  });

  it("continues a task list with a task item", () => {
    const editor = makeEditor();
    try {
      setListWithCode(editor, "line1\n", { task: true });
      selectCodeBlockEnd(editor);
      expect(exitCodeBlockToList(editor)).toBe(true);

      const list = editor.state.doc.firstChild!;
      expect(list.type.name).toBe("taskList");
      expect(list.childCount).toBe(3);
      expect(list.child(2).type.name).toBe("taskItem");
    } finally {
      editor.destroy();
    }
  });

  it("is a no-op when the code block is not eligible", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<pre><code>line1\n</code></pre>");
      selectCodeBlockEnd(editor);
      const before = editor.getHTML();
      expect(exitCodeBlockToList(editor)).toBe(false);
      expect(editor.getHTML()).toBe(before);
    } finally {
      editor.destroy();
    }
  });
});

describe("Enter keymap", () => {
  it("exits to a new list item after a blank final line", () => {
    const editor = makeEditor();
    try {
      setListWithCode(editor, "line1");
      selectCodeBlockEnd(editor);
      // First Enter adds the blank line...
      pressEnter(editor);
      expect(editor.state.doc.firstChild?.childCount).toBe(2);
      // ...second Enter continues the enumeration.
      pressEnter(editor);
      const list = editor.state.doc.firstChild!;
      expect(list.childCount).toBe(3);
      expect(list.child(1).lastChild?.textContent).toBe("line1");
    } finally {
      editor.destroy();
    }
  });

  it("leaves mid-line Enter as a newline in the code", () => {
    const editor = makeEditor();
    try {
      let start = -1;
      setListWithCode(editor, "line1");
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "codeBlock") start = pos + 1;
        return true;
      });
      editor.commands.setTextSelection(start);
      pressEnter(editor);
      expect(editor.state.doc.firstChild?.childCount).toBe(2);
      expect(editor.state.doc.firstChild?.lastChild?.lastChild?.textContent).toBe(
        "\nline1",
      );
    } finally {
      editor.destroy();
    }
  });
});
