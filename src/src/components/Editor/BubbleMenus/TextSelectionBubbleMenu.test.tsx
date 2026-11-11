// @vitest-environment jsdom

// Regression tests for the text-selection bubble menu's visibility.
//
// The menu is edit-mode only: it must surface for a selection while the
// document is editable, and stay hidden for a read-only (view mode)
// selection.

import "../../../test/setup";

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextSelectionBubbleMenu } from "./TextSelectionBubbleMenu";

// jsdom has no layout engine, so ProseMirror's `coordsAtPos` would blow
// up on `Range#getClientRects`. Give it a synthetic, non-zero rect.
function stubRects() {
  const rect = {
    top: 0,
    left: 0,
    bottom: 10,
    right: 10,
    width: 10,
    height: 10,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
  const rectList = [rect] as unknown as DOMRectList;
  Range.prototype.getClientRects = () => rectList;
  Range.prototype.getBoundingClientRect = () => rect;
  Element.prototype.getClientRects = () => rectList;
  Element.prototype.getBoundingClientRect = () => rect;
}

function makeEditor(editable: boolean): Editor {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return new Editor({
    element: el,
    editable,
    extensions: [StarterKit],
    content: "<p>Hello world selection</p>",
  });
}

describe("TextSelectionBubbleMenu visibility", () => {
  let editor: Editor | null = null;

  beforeEach(stubRects);

  afterEach(() => {
    // React Testing Library's automatic cleanup unmounts the portal; do
    // not wipe `document.body` here or React tries to remove a node that
    // is already gone.
    editor?.destroy();
    editor = null;
  });

  it("shows formatting controls for an editable selection", () => {
    editor = makeEditor(true);
    render(<TextSelectionBubbleMenu editor={editor} />);
    act(() => {
      editor!.commands.setTextSelection({ from: 1, to: 6 });
    });
    expect(
      screen.getAllByRole("button", { name: "Bold" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Copy with formatting" })
        .length,
    ).toBeGreaterThan(0);
  });

  it("appears when the editor becomes editable with an existing selection", () => {
    // Regression: entering edit mode (or toggling `enabled`) changes
    // neither the selection nor the doc, so the BubbleMenu plugin never
    // re-runs its `shouldShow` hook. The wrapper used to stay detached
    // until the next save/keystroke, leaving the menu inactive.
    editor = makeEditor(false);
    const { rerender } = render(
      <TextSelectionBubbleMenu editor={editor} enabled={false} />,
    );
    act(() => {
      editor!.commands.setTextSelection({ from: 1, to: 6 });
    });
    act(() => {
      editor!.setEditable(true);
      rerender(<TextSelectionBubbleMenu editor={editor!} enabled />);
    });
    expect(
      screen.getAllByRole("button", { name: "Bold" }).length,
    ).toBeGreaterThan(0);
  });

  it("stays hidden for a read-only selection (view mode)", () => {
    editor = makeEditor(false);
    render(<TextSelectionBubbleMenu editor={editor} enabled />);
    act(() => {
      editor!.commands.setTextSelection({ from: 1, to: 6 });
    });
    expect(
      screen.queryAllByRole("button", { name: "Bold" }).length,
    ).toBe(0);
    expect(
      screen.queryAllByRole("button", { name: "Copy with formatting" })
        .length,
    ).toBe(0);
    expect(
      screen.queryAllByRole("button", { name: "Copy as plain text" })
        .length,
    ).toBe(0);
  });
});
