// Unit tests for `handleTableBackspaceKey` -- the Backspace handler
// that clears a structurally empty table / row.
//
// Like `codeBlockTabKey.test.ts`, we build a real Tiptap `Editor`,
// call the handler directly with a synthetic `KeyboardEvent`, and
// assert on the resulting document.

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Image } from "@tiptap/extension-image";
import { TableMap } from "@tiptap/pm/tables";
import { handleTableBackspaceKey } from "./tableBackspaceKey";

const editors: Editor[] = [];

function freshEditor(content = ""): Editor {
  const editor = new Editor({
    extensions: [StarterKit, Table, TableRow, TableCell, TableHeader, Image],
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

function tablePos(editor: Editor): number {
  let pos = -1;
  editor.state.doc.descendants((node, p) => {
    if (node.type.name === "table" && pos === -1) pos = p;
  });
  return pos;
}

/** Caret position inside the paragraph of the cell at `(row, col)`. */
function cellCaret(editor: Editor, row: number, col: number): number {
  const tPos = tablePos(editor);
  const tableNode = editor.state.doc.nodeAt(tPos);
  if (!tableNode) throw new Error("no table in document");
  const map = TableMap.get(tableNode);
  return tPos + 1 + map.positionAt(row, col, tableNode) + 2;
}

const dispatchKey = (
  editor: Editor,
  options: { key?: string; meta?: boolean; ctrl?: boolean } = {},
): { handled: boolean; event: KeyboardEvent } => {
  const event = new KeyboardEvent("keydown", {
    key: options.key ?? "Backspace",
    metaKey: options.meta ?? false,
    ctrlKey: options.ctrl ?? false,
    bubbles: true,
    cancelable: true,
  });
  const handled = handleTableBackspaceKey(editor.view, event);
  return { handled, event };
};

function emptyTable(editor: Editor, rows: number, cols: number): void {
  editor.commands.insertTable({ rows, cols, withHeaderRow: false });
}

describe("handleTableBackspaceKey", () => {
  it("returns false outside a table", () => {
    const editor = freshEditor("<p>hello</p>");
    editor.commands.focus("end");

    const { handled, event } = dispatchKey(editor);

    expect(handled).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(tablePos(editor)).toBe(-1);
  });

  it("ignores non-Backspace keys", () => {
    const editor = freshEditor();
    emptyTable(editor, 2, 2);
    editor.commands.setTextSelection(cellCaret(editor, 0, 0));

    const { handled } = dispatchKey(editor, { key: "Delete" });

    expect(handled).toBe(false);
    expect(editor.state.doc.firstChild?.type.name).toBe("table");
  });

  it("ignores modifier Backspace so built-in shortcuts keep working", () => {
    const editor = freshEditor();
    emptyTable(editor, 2, 2);
    editor.commands.setTextSelection(cellCaret(editor, 0, 0));

    const { handled } = dispatchKey(editor, { meta: true });

    expect(handled).toBe(false);
    expect(editor.state.doc.firstChild?.type.name).toBe("table");
  });

  it("deletes the whole table when it is empty and the caret is in the first cell", () => {
    const editor = freshEditor();
    emptyTable(editor, 2, 2);
    editor.commands.setTextSelection(cellCaret(editor, 0, 0));

    const { handled, event } = dispatchKey(editor);

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(tablePos(editor)).toBe(-1);
  });

  it("deletes an empty row (but not a populated one)", () => {
    const editor = freshEditor(
      "<table><tbody>" +
        "<tr><td><p></p></td><td><p></p></td></tr>" +
        "<tr><td><p>keep me</p></td><td><p>x</p></td></tr>" +
        "</tbody></table>",
    );
    editor.commands.setTextSelection(cellCaret(editor, 0, 0));

    const { handled, event } = dispatchKey(editor);

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    const tableNode = editor.state.doc.nodeAt(tablePos(editor));
    expect(tableNode?.childCount).toBe(1);
    expect(tableNode?.textContent).toBe("keep mex");
  });

  it("deletes a later empty row when the caret is in its first cell", () => {
    const editor = freshEditor(
      "<table><tbody>" +
        "<tr><td><p>head</p></td><td><p>x</p></td></tr>" +
        "<tr><td><p></p></td><td><p></p></td></tr>" +
        "</tbody></table>",
    );
    editor.commands.setTextSelection(cellCaret(editor, 1, 0));

    const { handled } = dispatchKey(editor);

    expect(handled).toBe(true);
    const tableNode = editor.state.doc.nodeAt(tablePos(editor));
    expect(tableNode?.childCount).toBe(1);
    expect(tableNode?.textContent).toBe("headx");
  });

  it("moves the caret into the row above after deleting an empty row", () => {
    const editor = freshEditor(
      "<table><tbody>" +
        "<tr><td><p>above</p></td><td><p></p></td></tr>" +
        "<tr><td><p>below</p></td><td><p></p></td></tr>" +
        "<tr><td><p></p></td><td><p></p></td></tr>" +
        "</tbody></table>",
    );
    editor.commands.setTextSelection(cellCaret(editor, 2, 0));

    const { handled } = dispatchKey(editor);

    expect(handled).toBe(true);
    const tableNode = editor.state.doc.nodeAt(tablePos(editor));
    expect(tableNode?.childCount).toBe(2);
    // The caret must land in the row that was above the deleted one
    // ("below"), not the row that shifted up into its place.
    expect(editor.state.selection.$from.parent.textContent).toBe("below");
  });

  it("moves the caret into the new first row when deleting the first row", () => {
    const editor = freshEditor(
      "<table><tbody>" +
        "<tr><td><p></p></td><td><p></p></td></tr>" +
        "<tr><td><p>survivor</p></td><td><p></p></td></tr>" +
        "</tbody></table>",
    );
    editor.commands.setTextSelection(cellCaret(editor, 0, 0));

    const { handled } = dispatchKey(editor);

    expect(handled).toBe(true);
    const tableNode = editor.state.doc.nodeAt(tablePos(editor));
    expect(tableNode?.childCount).toBe(1);
    expect(editor.state.selection.$from.parent.textContent).toBe("survivor");
  });

  it("does nothing when the caret is not in the first cell of the row", () => {
    const editor = freshEditor(
      "<table><tbody>" +
        "<tr><td><p>a</p></td><td><p></p></td></tr>" +
        "<tr><td><p>b</p></td><td><p></p></td></tr>" +
        "</tbody></table>",
    );
    editor.commands.setTextSelection(cellCaret(editor, 0, 1));

    const { handled, event } = dispatchKey(editor);

    expect(handled).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(editor.state.doc.nodeAt(tablePos(editor))?.childCount).toBe(2);
  });

  it("does nothing when the first cell of the row holds text", () => {
    const editor = freshEditor(
      "<table><tbody>" +
        "<tr><td><p>filled</p></td><td><p></p></td></tr>" +
        "</tbody></table>",
    );
    editor.commands.setTextSelection(cellCaret(editor, 0, 0));

    const { handled } = dispatchKey(editor);

    expect(handled).toBe(false);
    expect(tablePos(editor)).not.toBe(-1);
  });

  it("treats a cell holding a leaf node (image) as non-empty", () => {
    const editor = freshEditor(
      "<table><tbody>" +
        "<tr><td><p><img src=\"x.png\"></p></td><td><p></p></td></tr>" +
        "<tr><td><p></p></td><td><p></p></td></tr>" +
        "</tbody></table>",
    );
    editor.commands.setTextSelection(cellCaret(editor, 0, 0));

    const { handled } = dispatchKey(editor);

    expect(handled).toBe(false);
    expect(tablePos(editor)).not.toBe(-1);
  });

  it("ignores non-collapsed selections", () => {
    const editor = freshEditor(
      "<table><tbody>" +
        "<tr><td><p>abcd</p></td><td><p></p></td></tr>" +
        "</tbody></table>",
    );
    const from = cellCaret(editor, 0, 0);
    editor.commands.setTextSelection({ from, to: from + 2 });

    const { handled } = dispatchKey(editor);

    expect(handled).toBe(false);
    expect(tablePos(editor)).not.toBe(-1);
  });
});
