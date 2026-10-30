// @vitest-environment jsdom

// Context-target resolution: which node the pointer is over, and how
// the editor selection is placed so the commands act on it.

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { TextSelection } from "@tiptap/pm/state";
import {
  applyEditorContextTarget,
  resolveEditorContextTarget,
} from "./editorContextTarget";

function makeEditor(content = "<p>hi</p>"): Editor {
  return new Editor({
    extensions: [
      StarterKit,
      Image,
      Table,
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
  });
}

function findNodePos(editor: Editor, name: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === name && found === -1) found = pos;
  });
  return found;
}

function hitAt(editor: Editor, pos: number): void {
  editor.view.posAtCoords = () => ({ pos, inside: -1 });
}

describe("resolveEditorContextTarget", () => {
  it("resolves an image hit", () => {
    const editor = makeEditor('<img src="a.png"><p>x</p>');
    try {
      hitAt(editor, findNodePos(editor, "image"));
      const target = resolveEditorContextTarget(editor, { x: 1, y: 1 });
      expect(target?.kind).toBe("image");
      expect(target?.from).toBe(findNodePos(editor, "image"));
    } finally {
      editor.destroy();
    }
  });

  it("resolves a code block hit", () => {
    const editor = makeEditor("<pre><code>const a = 1;</code></pre>");
    try {
      hitAt(editor, findNodePos(editor, "codeBlock"));
      const target = resolveEditorContextTarget(editor, { x: 1, y: 1 });
      expect(target?.kind).toBe("codeBlock");
    } finally {
      editor.destroy();
    }
  });

  it("resolves an image inside a table cell as the image", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      // Put an image in the first cell's paragraph.
      const cellPos = findNodePos(editor, "table") + 3;
      editor.commands.insertContentAt(cellPos, {
        type: "image",
        attrs: { src: "a.png" },
      });
      const imagePos = findNodePos(editor, "image");
      hitAt(editor, imagePos);
      const target = resolveEditorContextTarget(editor, { x: 1, y: 1 });
      expect(target?.kind).toBe("image");
      expect(target?.from).toBe(imagePos);
    } finally {
      editor.destroy();
    }
  });

  it("resolves a code block inside a table cell as the code block", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      const cellPos = findNodePos(editor, "table") + 3;
      editor.commands.insertContentAt(cellPos, {
        type: "codeBlock",
        content: [{ type: "text", text: "const a = 1;" }],
      });
      const codePos = findNodePos(editor, "codeBlock");
      hitAt(editor, codePos);
      const target = resolveEditorContextTarget(editor, { x: 1, y: 1 });
      expect(target?.kind).toBe("codeBlock");
      expect(target?.from).toBe(codePos);
    } finally {
      editor.destroy();
    }
  });

  it("prefers the image DOM target over a table coordinate hit", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      const cellPos = findNodePos(editor, "table") + 3;
      editor.commands.insertContentAt(cellPos, {
        type: "image",
        attrs: { src: "a.png" },
      });
      const imagePos = findNodePos(editor, "image");
      // Coordinates snap to the enclosing table cell.
      hitAt(editor, cellPos);
      const img = editor.view.dom.querySelector("img")!;
      const target = resolveEditorContextTarget(editor, { x: 1, y: 1 }, img);
      expect(target?.kind).toBe("image");
      expect(target?.from).toBe(imagePos);
    } finally {
      editor.destroy();
    }
  });

  it("resolves a table hit from a cell position", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      // Land on the first cell's paragraph interior.
      const tablePos = findNodePos(editor, "table");
      hitAt(editor, tablePos + 3);
      const target = resolveEditorContextTarget(editor, { x: 1, y: 1 });
      expect(target?.kind).toBe("table");
      expect(target?.from).toBe(tablePos);
    } finally {
      editor.destroy();
    }
  });

  it("keeps the cell hit position for a table DOM target", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      const tablePos = findNodePos(editor, "table");
      const cellHit = tablePos + 3;
      // The pointer is in the cell, but the event target is the table
      // itself (for example a wrapper). Coordinates must keep the cell
      // position so the table commands can find the cell.
      hitAt(editor, cellHit);
      const table = editor.view.dom.querySelector("table")!;
      const target = resolveEditorContextTarget(editor, { x: 1, y: 1 }, table);
      expect(target?.kind).toBe("table");
      expect(target?.hitPos).toBe(cellHit);
    } finally {
      editor.destroy();
    }
  });

  it("returns null over plain text", () => {
    const editor = makeEditor();
    try {
      hitAt(editor, 1);
      expect(resolveEditorContextTarget(editor, { x: 1, y: 1 })).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("resolves from the DOM target when coordinates miss", () => {
    const editor = makeEditor('<img src="a.png"><p>x</p>');
    try {
      // Coordinates return nothing, so the DOM element must win.
      editor.view.posAtCoords = () => null;
      const img = editor.view.dom.querySelector("img")!;
      const target = resolveEditorContextTarget(
        editor,
        { x: 1, y: 1 },
        img,
      );
      expect(target?.kind).toBe("image");
    } finally {
      editor.destroy();
    }
  });
});

describe("applyEditorContextTarget", () => {
  it("leaves the selection untouched for an image", () => {
    const editor = makeEditor('<img src="a.png"><p>x</p>');
    try {
      const from = findNodePos(editor, "image");
      hitAt(editor, from);
      const target = resolveEditorContextTarget(editor, { x: 1, y: 1 })!;
      const before = editor.state.selection;
      applyEditorContextTarget(editor, target);
      // No new node selection: the image is marked only by the highlight.
      expect(editor.state.selection).toBe(before);
    } finally {
      editor.destroy();
    }
  });

  it("places a text selection inside a table cell", () => {
    const editor = makeEditor();
    try {
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      const tablePos = findNodePos(editor, "table");
      const hit = tablePos + 3;
      hitAt(editor, hit);
      const target = resolveEditorContextTarget(editor, { x: 1, y: 1 })!;
      applyEditorContextTarget(editor, target);
      expect(editor.state.selection).toBeInstanceOf(TextSelection);
    } finally {
      editor.destroy();
    }
  });
});
