// Unit tests for `handleCodeBlockTabKey` -- the Tab / Shift+Tab key
// handler used inside the editor's `editorProps.handleKeyDown`.
//
// We seed an editor with a `codeBlock` extension, drive the handler
// the same way a real keystroke does (call it directly with a
// synthetic `KeyboardEvent`), and assert on the resulting document.
//
// `@vitest-environment jsdom` -- Tiptap's `Editor` constructor reads
// `window` while building its initial document; running under plain
// node throws "no window object available".

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { handleCodeBlockTabKey } from "./codeBlockTabKey";

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit],
  });
}

const editors: Editor[] = [];

function freshEditor(): Editor {
  const editor = makeEditor();
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

/** Builds the `KeyboardEvent` the handler expects and invokes it.
 *  `@tiptap/pm`'s `handleKeyDown` chain returns `true` when the key
 *  is consumed, so we expose that for the tests to assert on. */
const dispatchKey = (
  editor: Editor,
  options: { key: string; shift?: boolean } = { key: "Tab" },
): { handled: boolean; event: KeyboardEvent } => {
  const event = new KeyboardEvent("keydown", {
    key: options.key,
    shiftKey: options.shift ?? false,
    bubbles: true,
    cancelable: true,
  });
  const handled = handleCodeBlockTabKey(editor.view, event);
  return { handled, event };
};

const dispatchTab = (
  editor: Editor,
  options: { shift?: boolean; key?: "Tab" } = {},
): { handled: boolean; event: KeyboardEvent } =>
  dispatchKey(editor, { key: options.key ?? "Tab", shift: options.shift });

const text = (editor: Editor): string => editor.state.doc.textContent;

describe("handleCodeBlockTabKey", () => {
  it("returns false outside a codeBlock so default Tab runs", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p>hello</p>");
    editor.commands.focus("end");

    const { handled, event } = dispatchTab(editor);

    expect(handled).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(text(editor)).toBe("hello");
  });

  it("leaves Tab alone on a list item -- no preventDefault, no doc change", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<ul><li><p>Ship shared-note collaboration</p></li><li><p>Garage file permissions v2</p></li></ul>",
    );
    // Caret inside the second list item.
    editor.commands.setTextSelection(54);

    const { handled, event } = dispatchTab(editor);

    expect(handled).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    // The native list-indent behaviour has to keep working -- the
    // list item count must stay at two and the text must not gain
    // spaces.
    expect(text(editor)).toBe(
      "Ship shared-note collaborationGarage file permissions v2",
    );
  });

  it("leaves non-Tab keys completely untouched", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<pre><code class=\"language-plaintext\">x</code></pre>",
    );
    editor.commands.focus();

    const { handled, event } = dispatchKey(editor, { key: "Enter" });

    expect(handled).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(text(editor)).toBe("x");
  });

  it("inserts two spaces when Tab fires on an empty codeBlock caret", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<pre><code class=\"language-plaintext\"></code></pre>",
    );
    editor.commands.focus();

    const { handled } = dispatchTab(editor);

    expect(handled).toBe(true);
    expect(text(editor)).toBe("  ");
  });

  it("indents at the caret on a line of code", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<pre><code class=\"language-plaintext\">const a = 1;</code></pre>",
    );
    // Move the caret to the start of the codeBlock.
    editor.commands.setTextSelection(1);

    dispatchTab(editor);

    expect(text(editor)).toBe("  const a = 1;");
  });

  it("removes two leading spaces on Shift+Tab", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<pre><code class=\"language-plaintext\">  const a = 1;</code></pre>",
    );
    editor.commands.setTextSelection(3); // caret right after the two spaces

    dispatchTab(editor, { shift: true });

    expect(text(editor)).toBe("const a = 1;");
  });

  it("leaves the document alone on Shift+Tab when there is no leading whitespace", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<pre><code class=\"language-plaintext\">const a = 1;</code></pre>",
    );
    editor.commands.setTextSelection(1);

    dispatchTab(editor, { shift: true });

    expect(text(editor)).toBe("const a = 1;");
  });

  it("indents every line covered by a multi-line selection", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<pre><code class=\"language-plaintext\">a\nb\nc</code></pre>",
    );
    // Select the whole block content. Position 1 is the start of
    // the codeBlock's first content position; the inner content runs
    // from 1 to 7 (a, hardBreak, b, hardBreak, c).
    editor.commands.setTextSelection({ from: 1, to: 7 });

    dispatchTab(editor);

    expect(text(editor)).toBe("  a\n  b\n  c");
  });

  it("outdents every line covered by a multi-line selection", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<pre><code class=\"language-plaintext\">  a\n  b\n  c</code></pre>",
    );
    editor.commands.setTextSelection({ from: 1, to: 13 });

    dispatchTab(editor, { shift: true });

    expect(text(editor)).toBe("a\nb\nc");
  });

  it("indents only the lines the selection actually touches", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<pre><code class=\"language-plaintext\">a\nb\nc\nd</code></pre>",
    );
    // Select from the start of "b" (position 3) to the end of "c"
    // (position 7): only lines b and c should be indented.
    editor.commands.setTextSelection({ from: 3, to: 7 });

    dispatchTab(editor);

    expect(text(editor)).toBe("a\n  b\n  c\nd");
  });
});
