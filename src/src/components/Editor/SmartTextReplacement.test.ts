// Unit tests for `SmartTextReplacement` — the ProseMirror extension that
// rewrites ASCII sequences like "--" -> en-dash and "->" -> arrow as the
// user types. Each test seeds an editor, dispatches a synthetic text
// input through `view.someProp("handleTextInput", ...)` (which is the same
// hook ProseMirror calls from real key events), and then asserts on the
// resulting document text and caret position.
//
// `@vitest-environment jsdom` — Tiptap's `Editor` constructor reads
// `window` while building its initial document; running this suite under
// node throws "no window object available".

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  SmartTextReplacement,
  smartTextReplacementPluginKey,
} from "./SmartTextReplacement";

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit, SmartTextReplacement],
  });
}

const editors: Editor[] = [];

function freshEditor(): Editor {
  const e = makeEditor();
  editors.push(e);
  return e;
}

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

function findPlugin(editor: Editor) {
  const plugin = editor.state.plugins.find(
    (p) => p.spec.key === smartTextReplacementPluginKey,
  );
  if (!plugin) {
    throw new Error("SmartTextReplacement plugin not found");
  }
  return plugin;
}

/**
 * Dispatches a synthetic text input event the same way ProseMirror does
 * for real keypresses: locate the `handleTextInput` prop on the
 * SmartTextReplacement extension's plugin and call it with the
 * insertion parameters. We invoke the plugin directly because
 * `view.someProp` iterates plugin order, which makes it fragile in
 * tests; our plugin is the only source of these rules.
 *
 * @returns whether `handleTextInput` claimed the event (i.e. returned
 * truthy).
 */
const dispatchTextInput = (
  editor: Editor,
  from: number,
  to: number,
  text: string,
): boolean => {
  const handler = findPlugin(editor).props.handleTextInput;
  if (typeof handler !== "function") {
    throw new Error("SmartTextReplacement handleTextInput not found");
  }
  // The plugin handler signature is
  // `(this: any, view, from, to, text, deflt) => boolean | void`.
  // We cast to a no-`this` function type so we can invoke it
  // without a `this` argument.
  const plainHandler = handler as (
    view: typeof editor.view,
    from: number,
    to: number,
    text: string,
    deflt: () => unknown,
  ) => boolean | void;
  return Boolean(
    plainHandler(editor.view, from, to, text, () =>
      editor.state.tr.insertText(text, from, to),
    ),
  );
};

/**
 * Invokes the plugin's `handleKeyDown` prop with a minimal synthetic
 * event carrying only the `key` the handler reads.
 *
 * @returns whether `handleKeyDown` claimed the event.
 */
const dispatchKeyDown = (editor: Editor, key: string): boolean => {
  const handler = findPlugin(editor).props.handleKeyDown;
  if (typeof handler !== "function") {
    throw new Error("SmartTextReplacement handleKeyDown not found");
  }
  const plainHandler = handler as (
    view: typeof editor.view,
    event: { key: string },
  ) => boolean | void;
  return Boolean(plainHandler(editor.view, { key }));
};

describe("SmartTextReplacement", () => {
  it("rewrites `--` into an en-dash at the caret", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p>hello</p>");
    editor.commands.focus("end");
    // Caret is at position 6 (after "hello" inside <p>...</p>).
    const handled = dispatchTextInput(editor, 6, 6, "--");
    expect(handled).toBe(true);

    expect(editor.state.doc.textContent).toBe("hello–");
    expect(editor.state.selection.from).toBe(7); // one char after the en-dash
  });

  it("rewrites `->` into a right arrow at the caret", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p>x</p>");
    editor.commands.focus("end");
    const handled = dispatchTextInput(editor, 2, 2, "->");
    expect(handled).toBe(true);

    expect(editor.state.doc.textContent).toBe("x→");
    expect(editor.state.selection.from).toBe(3);
  });

  it("rewrites `=>` into a double right arrow", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p></p>");
    editor.commands.focus("end");
    const handled = dispatchTextInput(editor, 1, 1, "=>");
    expect(handled).toBe(true);

    expect(editor.state.doc.textContent).toBe("⇒");
    expect(editor.state.selection.from).toBe(2);
  });

  it("handles a `--` whose first dash already exists in the document", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p>hello-</p>");
    editor.commands.focus("end");
    // The trailing "-" is already at position 6; typing a second "-"
    // would normally make the doc "hello--". The replacement should
    // collapse the two dashes into an en-dash.
    const handled = dispatchTextInput(editor, 7, 7, "-");
    expect(handled).toBe(true);

    expect(editor.state.doc.textContent).toBe("hello–");
    expect(editor.state.selection.from).toBe(7);
  });

  it("leaves unrelated characters alone", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p>hello</p>");
    editor.commands.focus("end");
    // The handler reports no rule matched. We don't drive the default
    // text-insertion machinery here (the test calls `handleTextInput`
    // directly), so we only assert the contract — false means "let the
    // caller insert this text verbatim".
    const handled = dispatchTextInput(editor, 6, 6, " world");
    expect(handled).toBe(false);
  });

  it("does not match when `--` is not at the very end of the input", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p></p>");
    editor.commands.focus("end");
    // `--!` ends with `-!`, not `--`, so the rule does not match even
    // though the pattern appears earlier in the inserted text.
    const handled = dispatchTextInput(editor, 1, 1, "--!");
    expect(handled).toBe(false);
  });

  it("handles `--` typed after a `-` already in the document", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p>xx-</p>");
    editor.commands.focus("end");
    // Existing "-" plus the newly typed "-" makes `--` at the end.
    const handled = dispatchTextInput(editor, 4, 4, "-");
    expect(handled).toBe(true);

    expect(editor.state.doc.textContent).toBe("xx–");
    expect(editor.state.selection.from).toBe(4);
  });

  it("does not replace inside a code block", () => {
    const editor = freshEditor();
    editor.commands.setContent("<pre><code>-</code></pre>");
    // Caret at the end of the code block's only text character.
    editor.commands.setTextSelection(2);

    const handled = dispatchTextInput(editor, 2, 2, "-");
    expect(handled).toBe(false);
  });

  it("does not replace inside inline code", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p><code>-</code></p>");
    // Caret at the end of the inline-code text.
    editor.commands.setTextSelection(2);

    const handled = dispatchTextInput(editor, 2, 2, "-");
    expect(handled).toBe(false);
  });

  it("restores the ASCII sequence when Backspace follows a substitution", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p>hello</p>");
    editor.commands.focus("end");
    expect(dispatchTextInput(editor, 6, 6, "--")).toBe(true);
    expect(editor.state.doc.textContent).toBe("hello–");

    const handled = dispatchKeyDown(editor, "Backspace");
    expect(handled).toBe(true);
    expect(editor.state.doc.textContent).toBe("hello--");
    // Caret sits after the restored two dashes.
    expect(editor.state.selection.from).toBe(8);
  });

  it("allows the substitution to be redone after the undo", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p>hello</p>");
    editor.commands.focus("end");
    expect(dispatchTextInput(editor, 6, 6, "--")).toBe(true);
    expect(dispatchKeyDown(editor, "Backspace")).toBe(true);
    expect(editor.state.doc.textContent).toBe("hello--");

    // Delete the trailing dash and type it again: the rule fires anew.
    editor.commands.deleteRange({ from: 7, to: 8 });
    expect(editor.state.doc.textContent).toBe("hello-");
    expect(dispatchTextInput(editor, 7, 7, "-")).toBe(true);
    expect(editor.state.doc.textContent).toBe("hello–");
  });

  it("does not undo a substitution once the caret has moved away", () => {
    const editor = freshEditor();
    editor.commands.setContent("<p>hello</p>");
    editor.commands.focus("end");
    expect(dispatchTextInput(editor, 6, 6, "--")).toBe(true);

    // Type another character (which invalidates the pending undo via the
    // plugin's state reducer), then place the caret back after the glyph.
    editor.commands.insertContentAt(7, "x");
    expect(editor.state.doc.textContent).toBe("hello–x");
    editor.commands.setTextSelection(7);

    expect(dispatchKeyDown(editor, "Backspace")).toBe(false);
    expect(editor.state.doc.textContent).toBe("hello–x");
  });
});
