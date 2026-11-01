// Tests for reordering elements inside lists.

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { NodeSelection } from "@tiptap/pm/state";
import {
  getListElementMergePreview,
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

/** A list item whose lead paragraph is followed by a nested bullet list. */
function nestedItem(label: string, children: string[]): JSONContent {
  return {
    type: "listItem",
    content: [
      paragraph(label),
      {
        type: "bulletList",
        content: children.map((child) => ({
          type: "listItem",
          content: [paragraph(child)],
        })),
      },
    ],
  };
}

/** Lead-paragraph texts of every list item, in document order. */
function itemTexts(editor: Editor): string[] {
  const texts: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "listItem" && node.firstChild?.isTextblock) {
      texts.push(node.firstChild.textContent);
    }
    return true;
  });
  return texts;
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

describe("moveListElement - single element through depth", () => {
  /** Bullet list wrapper for a set of top-level list items. */
  function setTopLevel(editor: Editor, items: JSONContent[]): void {
    editor.commands.setContent({
      type: "doc",
      content: [{ type: "bulletList", content: items }],
    } as never);
  }

  const topItem = (label: string, children: string[] = []): JSONContent =>
    children.length > 0
      ? nestedItem(label, children)
      : { type: "listItem", content: [paragraph(label)] };

  it("lifts a lone nested item down past its parent", () => {
    const editor = makeEditor();
    try {
      setTopLevel(editor, [topItem("a", ["a1"]), topItem("b")]);
      selectText(editor, "a1");
      // a1 can drop out of a (down) and also pop ahead of a (up).
      expect(getListElementMoveState(editor.state)).toEqual({
        canMoveUp: true,
        canMoveDown: true,
      });
      expect(moveListElement(editor, 1)).toBe(true);
      // Only a1 moved; its parent a stayed put without the nested list.
      expect(itemTexts(editor)).toEqual(["a", "a1", "b"]);
      expect(outline(editor)).toEqual([["a"], ["a1"], ["b"]]);
    } finally {
      editor.destroy();
    }
  });

  it("lifts a lone nested item up before its parent", () => {
    const editor = makeEditor();
    try {
      setTopLevel(editor, [topItem("b"), topItem("a", ["a1"])]);
      selectText(editor, "a1");
      expect(moveListElement(editor, -1)).toBe(true);
      expect(itemTexts(editor)).toEqual(["b", "a1", "a"]);
      expect(outline(editor)).toEqual([["b"], ["a1"], ["a"]]);
    } finally {
      editor.destroy();
    }
  });

  it("reorders same-level siblings without touching the parent", () => {
    const editor = makeEditor();
    try {
      setTopLevel(editor, [topItem("a", ["a1", "a2"]), topItem("b")]);
      selectText(editor, "a1");
      expect(moveListElement(editor, 1)).toBe(true);
      expect(itemTexts(editor)).toEqual(["a", "a2", "a1", "b"]);
      expect(outline(editor)).toEqual([["a", "bulletList"], ["b"]]);
    } finally {
      editor.destroy();
    }
  });

  it("walks a deeply nested item through several levels", () => {
    const editor = makeEditor();
    try {
      // Three levels: a > a1 > a1x, followed by a top-level b.
      editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  paragraph("a"),
                  {
                    type: "bulletList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          paragraph("a1"),
                          {
                            type: "bulletList",
                            content: [
                              { type: "listItem", content: [paragraph("a1x")] },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              topItem("b"),
            ],
          },
        ],
      } as never);

      selectText(editor, "a1x");
      expect(moveListElement(editor, -1)).toBe(true);
      // a1x pops out one level to sit beside a1.
      expect(itemTexts(editor)).toEqual(["a", "a1x", "a1", "b"]);

      // Caret followed a1x, so moving down swaps it with a1.
      expect(moveListElement(editor, 1)).toBe(true);
      expect(itemTexts(editor)).toEqual(["a", "a1", "a1x", "b"]);
    } finally {
      editor.destroy();
    }
  });

  it("stays disabled for a lone top-level item", () => {
    const editor = makeEditor();
    try {
      setTopLevel(editor, [topItem("only")]);
      selectText(editor, "only");
      expect(getListElementMoveState(editor.state)).toEqual({
        canMoveUp: false,
        canMoveDown: false,
      });
      expect(moveListElement(editor, -1)).toBe(false);
      expect(moveListElement(editor, 1)).toBe(false);
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

describe("getListElementMergePreview", () => {
  it("highlights the survivor as primary and the next bullet as secondary", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("a")], [paragraph("b")], [paragraph("c")]]);
      selectText(editor, "a");
      const preview = getListElementMergePreview(editor.state);
      const doc = editor.state.doc;
      expect(preview?.direction).toBe("down");
      expect(
        doc.textBetween(preview!.primaryFrom, preview!.primaryTo),
      ).toBe("a");
      expect(
        doc.textBetween(preview!.secondaryFrom, preview!.secondaryTo),
      ).toBe("b");
    } finally {
      editor.destroy();
    }
  });

  it("swaps the roles when the merge would fold upward", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("a")], [paragraph("b")]]);
      selectText(editor, "b");
      const preview = getListElementMergePreview(editor.state);
      const doc = editor.state.doc;
      expect(preview?.direction).toBe("up");
      expect(
        doc.textBetween(preview!.primaryFrom, preview!.primaryTo),
      ).toBe("a");
      expect(
        doc.textBetween(preview!.secondaryFrom, preview!.secondaryTo),
      ).toBe("b");
    } finally {
      editor.destroy();
    }
  });

  it("is null when there is nothing to merge", () => {
    const editor = makeEditor();
    try {
      setDoc(editor, [[paragraph("only")]]);
      selectText(editor, "only");
      expect(getListElementMergePreview(editor.state)).toBeNull();
    } finally {
      editor.destroy();
    }
  });
});
