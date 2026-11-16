// The Mermaid preview renders asynchronously, so its size changes land
// outside ProseMirror transactions. Browsers keep painting the native caret
// at its old screen position until the selection is written again, and
// ProseMirror's own `selectionToDOM` skips that write when the selection
// already matches its state. These tests pin down that the helper really
// rewrites an *unchanged* selection (and stays out of the way otherwise).

// @vitest-environment jsdom

import "../../../test/setup";

import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { syncCaretAfterPreviewResize } from "./mermaidPreviewResize";

const editors: Editor[] = [];

const makeEditor = (html = "<p>hello world</p>"): Editor => {
  // The editor has to live in the document, otherwise jsdom refuses to create
  // a DOM selection inside it.
  const host = document.createElement("div");
  document.body.appendChild(host);
  const editor = new Editor({
    element: host,
    extensions: [StarterKit],
    content: html,
  });
  editors.push(editor);
  return editor;
};

/** Text node holding the editor's first paragraph. */
const firstTextNode = (editor: Editor): Text => {
  const node = editor.view.dom.querySelector("p")?.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) {
    throw new Error("expected a text node in the editor");
  }
  return node as Text;
};

const selectIn = (editor: Editor, from: number, to: number): void => {
  const doc = editor.view.dom.ownerDocument;
  const text = firstTextNode(editor);
  const selection = doc.getSelection();
  if (!selection) throw new Error("no selection");
  const range = doc.createRange();
  range.setStart(text, from);
  range.setEnd(text, to);
  selection.removeAllRanges();
  selection.addRange(range);
};

afterEach(() => {
  // The document's Selection object is shared by every test, so spies on it
  // must not leak into the next case.
  vi.restoreAllMocks();
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.innerHTML = "";
});

describe("syncCaretAfterPreviewResize", () => {
  it("rewrites an unchanged selection so the caret is re-located", () => {
    const editor = makeEditor();
    vi.spyOn(editor.view, "hasFocus").mockReturnValue(true);
    selectIn(editor, 2, 5);

    const doc = editor.view.dom.ownerDocument;
    const selection = doc.getSelection()!;
    const removeAllRanges = vi.spyOn(selection, "removeAllRanges");

    syncCaretAfterPreviewResize(editor);

    // The rewrite is what makes the browser recompute the caret rect.
    expect(removeAllRanges).toHaveBeenCalledTimes(1);
    // ...and the selection itself must be unchanged.
    expect(selection.anchorNode).toBe(firstTextNode(editor));
    expect(selection.anchorOffset).toBe(2);
    expect(selection.focusOffset).toBe(5);
  });

  it("keeps a collapsed caret collapsed", () => {
    const editor = makeEditor();
    vi.spyOn(editor.view, "hasFocus").mockReturnValue(true);
    selectIn(editor, 4, 4);

    syncCaretAfterPreviewResize(editor);

    const selection = editor.view.dom.ownerDocument.getSelection()!;
    expect(selection.isCollapsed).toBe(true);
    expect(selection.anchorOffset).toBe(4);
  });

  it("leaves the selection alone when another field owns the focus", () => {
    const editor = makeEditor();
    vi.spyOn(editor.view, "hasFocus").mockReturnValue(false);
    selectIn(editor, 2, 5);

    const selection = editor.view.dom.ownerDocument.getSelection()!;
    const removeAllRanges = vi.spyOn(selection, "removeAllRanges");

    syncCaretAfterPreviewResize(editor);

    expect(removeAllRanges).not.toHaveBeenCalled();
  });

  it("never rewrites the selection during an IME composition", () => {
    const editor = makeEditor();
    vi.spyOn(editor.view, "hasFocus").mockReturnValue(true);
    vi.spyOn(editor.view, "composing", "get").mockReturnValue(true);
    selectIn(editor, 2, 5);

    const selection = editor.view.dom.ownerDocument.getSelection()!;
    const removeAllRanges = vi.spyOn(selection, "removeAllRanges");

    syncCaretAfterPreviewResize(editor);

    expect(removeAllRanges).not.toHaveBeenCalled();
  });

  it("ignores a selection that lives outside the editor", () => {
    const editor = makeEditor();
    vi.spyOn(editor.view, "hasFocus").mockReturnValue(true);

    const outside = document.createElement("p");
    outside.textContent = "outside";
    document.body.appendChild(outside);
    const doc = document;
    const selection = doc.getSelection()!;
    const range = doc.createRange();
    range.setStart(outside.firstChild!, 1);
    range.setEnd(outside.firstChild!, 3);
    selection.removeAllRanges();
    selection.addRange(range);

    const removeAllRanges = vi.spyOn(selection, "removeAllRanges");

    syncCaretAfterPreviewResize(editor);

    expect(removeAllRanges).not.toHaveBeenCalled();
  });
});