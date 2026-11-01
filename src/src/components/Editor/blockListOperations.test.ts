// Tests for moving generic blocks (image, blockquote, ...) between the
// document level and a list.

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { NodeSelection } from "@tiptap/pm/state";
import {
  canIndentBlockIntoList,
  canOutdentBlockFromList,
  indentBlockIntoList,
  outdentBlockFromList,
  selectionListLevel,
} from "./blockListOperations";

const IMAGE_NAMES: ReadonlySet<string> = new Set(["image"]);
const QUOTE_NAMES: ReadonlySet<string> = new Set(["blockquote"]);

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit.configure({ codeBlock: {} }), Image],
  });
}

/** Selects the first image node. */
function selectImage(editor: Editor): void {
  let pos = -1;
  editor.state.doc.descendants((node, nodePos) => {
    if (node.type.name === "image") pos = nodePos;
    return true;
  });
  editor.commands.setNodeSelection(pos);
}

/** Places the caret inside the first blockquote. */
function selectBlockquote(editor: Editor): void {
  let pos = -1;
  editor.state.doc.descendants((node, nodePos) => {
    if (node.type.name === "blockquote" && pos === -1) pos = nodePos;
    return true;
  });
  editor.commands.setTextSelection(pos + 2);
}

/** Parent type + index of the first node of `name`. */
function parentInfo(
  editor: Editor,
  name: string,
): { parentType: string; indexInParent: number } | null {
  let found: { parentType: string; indexInParent: number } | null = null;
  editor.state.doc.descendants((node, _pos, parent, index) => {
    if (node.type.name === name && !found) {
      found = { parentType: parent?.type.name ?? "", indexInParent: index };
    }
    return true;
  });
  return found;
}

describe("selectionListLevel", () => {
  it("counts list ancestors", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul><p>out</p>",
      );
      let aPos = -1;
      let bPos = -1;
      let outPos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (!node.isTextblock) return true;
        if (node.textContent === "a") aPos = pos;
        if (node.textContent === "b") bPos = pos;
        if (node.textContent === "out") outPos = pos;
        return true;
      });
      editor.commands.setTextSelection(aPos + 1);
      expect(selectionListLevel(editor.state)).toBe(1);
      editor.commands.setTextSelection(bPos + 1);
      expect(selectionListLevel(editor.state)).toBe(2);
      editor.commands.setTextSelection(outPos + 1);
      expect(selectionListLevel(editor.state)).toBe(0);
    } finally {
      editor.destroy();
    }
  });
});

describe("image in a list", () => {
  it("indents an image below a list into its last item", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p></li><li><p>two</p></li></ul>" +
          '<img src="http://x/a.png" />',
      );
      selectImage(editor);
      expect(canIndentBlockIntoList(editor.state, IMAGE_NAMES)).toBe(true);
      expect(indentBlockIntoList(editor, IMAGE_NAMES)).toBe(true);

      const info = parentInfo(editor, "image")!;
      expect(info.parentType).toBe("listItem");
      expect(info.indexInParent).toBe(1);
      expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    } finally {
      editor.destroy();
    }
  });

  it("outdents an image nested in a list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p>" +
          '<img src="http://x/a.png" /></li></ul><p>after</p>',
      );
      selectImage(editor);
      expect(canOutdentBlockFromList(editor.state, IMAGE_NAMES)).toBe(true);
      expect(outdentBlockFromList(editor, IMAGE_NAMES)).toBe(true);

      const info = parentInfo(editor, "image")!;
      expect(info.parentType).toBe("doc");
      expect(editor.state.doc.child(0).type.name).toBe("bulletList");
      expect(editor.state.doc.child(1).type.name).toBe("image");
    } finally {
      editor.destroy();
    }
  });
});

describe("blockquote in a list", () => {
  it("indents a quote below a list into its last item", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p></li></ul>" +
          "<blockquote><p>quoted</p></blockquote>",
      );
      selectBlockquote(editor);
      expect(canIndentBlockIntoList(editor.state, QUOTE_NAMES)).toBe(true);
      expect(indentBlockIntoList(editor, QUOTE_NAMES)).toBe(true);
      expect(parentInfo(editor, "blockquote")?.parentType).toBe("listItem");
    } finally {
      editor.destroy();
    }
  });

  it("outdents a quote nested in a list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent(
        "<ul><li><p>one</p>" +
          "<blockquote><p>quoted</p></blockquote></li></ul><p>after</p>",
      );
      selectBlockquote(editor);
      expect(canOutdentBlockFromList(editor.state, QUOTE_NAMES)).toBe(true);
      expect(outdentBlockFromList(editor, QUOTE_NAMES)).toBe(true);
      expect(parentInfo(editor, "blockquote")?.parentType).toBe("doc");
    } finally {
      editor.destroy();
    }
  });
});
