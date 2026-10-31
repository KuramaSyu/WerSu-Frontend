// Tests for reordering elements inside lists.

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { NodeSelection } from "@tiptap/pm/state";
import {
  getListElementMergeState,
  getListElementMoveState,
  mergeListItem,
  moveListElement,
} from "./listElementOperations";

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit.configure({ codeBlock: {} }), Image],
  });
}

const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const code = (text: string): JSONContent => ({
  type: "codeBlock",
  attrs: { language: "plaintext" },
  content: [{ type: "text", text }],
});

function setDoc(editor: Editor, items: JSONContent[][]): void {
  editor.commands.setContent({
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: items.map((content) => ({ type: "listItem", content })),
      },
      { type: "paragraph" },
    ],
  } as never);
}

/** Places the caret in the last text block matching `text`. */
function selectText(editor: Editor, text: string): void {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent === text) found = pos;
    return true;
  });
  editor.commands.setTextSelection(found + 1);
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

/** Flattens the document to a readable list-of-lists for assertions. */
function outline(editor: Editor): string[][] {
  const rows: string[][] = [];
  editor.state.doc.firstChild?.forEach((item) => {
    const blocks: string[] = [];
    item.forEach((child) => {
      blocks.push(child.type.name === "paragraph" ? child.textContent : child.type.name);
    });
    rows.push(blocks);
  });
  return rows;
}

describe("getListElementMoveState", () => {
  it("is null outside a list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello</p>");
      editor.commands.setTextSelection(2);
      expect(getListElementMoveState(editor.state)).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("disables up on the first item and down on the last", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("a")], [paragraph("b")]]);
      selectText(editor, "a");
      expect(getListElementMoveState(editor.state)).toEqual({
        canMoveUp: false,
        canMoveDown: true,
      });
      selectText(editor, "b");
      expect(getListElementMoveState(editor.state)).toEqual({
        canMoveUp: true,
        canMoveDown: false,
      });
    } finally {
      editor.destroy();
    }
  });
});

describe("moveListElement - whole item", () => {
  it("moves a bullet down", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("a")], [paragraph("b")], [paragraph("c")]]);
      selectText(editor, "a");
      expect(moveListElement(editor, 1)).toBe(true);
      expect(outline(editor)).toEqual([["b"], ["a"], ["c"]]);
    } finally {
      editor.destroy();
    }
  });

  it("moves a bullet up", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("a")], [paragraph("b")], [paragraph("c")]]);
      selectText(editor, "c");
      expect(moveListElement(editor, -1)).toBe(true);
      expect(outline(editor)).toEqual([["a"], ["c"], ["b"]]);
    } finally {
      editor.destroy();
    }
  });
});

describe("moveListElement - nested block", () => {
  it("swaps with a sibling inside the same item", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("a"), paragraph("b"), paragraph("c")]]);
      selectText(editor, "c");
      expect(moveListElement(editor, -1)).toBe(true);
      expect(outline(editor)).toEqual([["a", "c", "b"]]);
    } finally {
      editor.destroy();
    }
  });

  it("carries a code block down into the next item", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [
        [paragraph("a"), code("x")],
        [paragraph("b")],
      ]);
      selectText(editor, "x");
      expect(moveListElement(editor, 1)).toBe(true);
      expect(outline(editor)).toEqual([["a"], ["b", "codeBlock"]]);
    } finally {
      editor.destroy();
    }
  });

  it("carries a code block up into the previous item", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [
        [paragraph("a")],
        [paragraph("b"), code("x")],
      ]);
      selectText(editor, "x");
      expect(moveListElement(editor, -1)).toBe(true);
      expect(outline(editor)).toEqual([["a", "codeBlock"], ["b"]]);
    } finally {
      editor.destroy();
    }
  });

  it("moves an image (node selection) down into the next item", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [
        [
          paragraph("a"),
          { type: "image", attrs: { src: "http://x/a.png" } },
        ],
        [paragraph("b")],
      ]);
      selectImage(editor);
      expect(editor.state.selection).toBeInstanceOf(NodeSelection);
      expect(moveListElement(editor, 1)).toBe(true);
      expect(outline(editor)).toEqual([["a"], ["b", "image"]]);
      expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    } finally {
      editor.destroy();
    }
  });

  it("is a no-op at the boundary with no neighbour", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("a"), code("x")]]);
      selectText(editor, "x");
      const before = editor.getHTML();
      expect(moveListElement(editor, -1)).toBe(false);
      expect(moveListElement(editor, 1)).toBe(false);
      expect(editor.getHTML()).toBe(before);
    } finally {
      editor.destroy();
    }
  });
});

describe("getListElementMergeState", () => {
  it("is null outside a list", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello</p>");
      editor.commands.setTextSelection(2);
      expect(getListElementMergeState(editor.state)).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("offers merging down when the next bullet differs", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("a")], [paragraph("b")]]);
      selectText(editor, "a");
      expect(getListElementMergeState(editor.state)).toEqual({
        canMerge: true,
        direction: "down",
      });
    } finally {
      editor.destroy();
    }
  });

  it("falls back to merging up on the last differing bullet", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("a")], [paragraph("b")]]);
      selectText(editor, "b");
      expect(getListElementMergeState(editor.state)).toEqual({
        canMerge: true,
        direction: "up",
      });
    } finally {
      editor.destroy();
    }
  });

  it("refuses to merge identical bullets", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("same")], [paragraph("same")]]);
      // selectText lands on the second (last) match, so the fallback
      // direction is the previous bullet.
      selectText(editor, "same");
      expect(getListElementMergeState(editor.state)).toEqual({
        canMerge: false,
        direction: "up",
      });
    } finally {
      editor.destroy();
    }
  });

  it("refuses to merge a lone bullet", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("only")]]);
      selectText(editor, "only");
      expect(getListElementMergeState(editor.state)).toEqual({
        canMerge: false,
        direction: "up",
      });
    } finally {
      editor.destroy();
    }
  });
});

describe("mergeListItem", () => {
  it("joins two bullets into one, keeping the caret in the survivor", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("a")], [paragraph("b")], [paragraph("c")]]);
      selectText(editor, "a");
      expect(mergeListItem(editor, "down")).toBe(true);
      expect(outline(editor)).toEqual([["a b"], ["c"]]);
    } finally {
      editor.destroy();
    }
  });

  it("merges the last bullet upward", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("a")], [paragraph("b")]]);
      selectText(editor, "b");
      expect(mergeListItem(editor, "up")).toBe(true);
      expect(outline(editor)).toEqual([["a b"]]);
    } finally {
      editor.destroy();
    }
  });

  it("carries nested blocks from the consumed bullet", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [
        [paragraph("a"), code("x")],
        [paragraph("b")],
      ]);
      selectText(editor, "a");
      expect(mergeListItem(editor, "down")).toBe(true);
      expect(outline(editor)).toEqual([["a b", "codeBlock"]]);
    } finally {
      editor.destroy();
    }
  });

  it("is a no-op when the bullets match", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("same")], [paragraph("same")]]);
      selectText(editor, "same");
      const before = editor.getHTML();
      expect(mergeListItem(editor, "down")).toBe(false);
      expect(editor.getHTML()).toBe(before);
    } finally {
      editor.destroy();
    }
  });
});
