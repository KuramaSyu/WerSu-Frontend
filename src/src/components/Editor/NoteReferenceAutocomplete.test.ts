// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { NoteReference } from "./NoteReference";
import {
  NoteReferenceAutocompleteExtension,
  getNoteReferenceAutocompleteContext,
  insertNoteReferenceFromAutocomplete,
  isNoteReferenceAutocompleteOpen,
} from "./NoteReferenceAutocomplete";

const editors: Editor[] = [];

function makeEditor(content = ""): Editor {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false, undoRedo: false }),
      NoteReference,
      NoteReferenceAutocompleteExtension,
      Markdown,
    ],
    content,
    contentType: "markdown",
  });
  editors.push(editor);
  return editor;
}

function caretAtEnd(editor: Editor): void {
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
}

function insertAtCaret(editor: Editor, text: string): void {
  const { from } = editor.state.selection;
  editor.view.dispatch(editor.state.tr.insertText(text, from));
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe("note reference autocomplete context", () => {
  it("finds an empty auto-closed block", () => {
    const editor = makeEditor("{{}}");
    editor.commands.setTextSelection(3);

    expect(getNoteReferenceAutocompleteContext(editor)).toMatchObject({
      query: "",
      searchQuery: "",
    });
  });

  it("reads the typed query and closing range", () => {
    const editor = makeEditor("{{foo}}");
    editor.commands.setTextSelection(6);

    const context = getNoteReferenceAutocompleteContext(editor);
    expect(context).not.toBeNull();
    expect(context?.query).toBe("foo");
    expect(context?.searchQuery).toBe("foo");
    expect(context!.closeFrom - context!.queryTo).toBe(0);
  });

  it("strips a leading @ from the search query", () => {
    const editor = makeEditor("{{}}");
    editor.commands.setTextSelection(3);
    insertAtCaret(editor, "@foo");

    expect(getNoteReferenceAutocompleteContext(editor)?.searchQuery).toBe(
      "foo",
    );
  });

  it("stays closed when the caret is outside the braces", () => {
    const editor = makeEditor("{{foo}} after");
    editor.commands.setTextSelection(12);

    expect(getNoteReferenceAutocompleteContext(editor)).toBeNull();
  });

  it("closes after the caret passes the closing braces", () => {
    const editor = makeEditor("{{foo}}");
    editor.commands.setTextSelection(7);

    expect(getNoteReferenceAutocompleteContext(editor)).toBeNull();
  });

  it("rejects whitespace inside the braces", () => {
    const editor = makeEditor("{{foo bar}}");
    editor.commands.setTextSelection(8);

    expect(getNoteReferenceAutocompleteContext(editor)).toBeNull();
  });
});

describe("note reference autocomplete input handling", () => {
  it("auto-inserts }} when the second { is typed", () => {
    const editor = makeEditor("{");
    caretAtEnd(editor);
    const { from } = editor.state.selection;

    const handled = editor.view.someProp("handleTextInput", (handler) =>
      handler(editor.view, from, from, "{", () => editor.state.tr),
    );

    expect(handled).toBe(true);
    expect(editor.getText()).toBe("{{}}");
    expect(editor.state.selection.from).toBe(3);
    expect(isNoteReferenceAutocompleteOpen(editor)).toBe(true);
  });

  it("opens file menu context after typing a query inside the braces", () => {
    const editor = makeEditor("{{}}");
    editor.commands.setTextSelection(3);
    insertAtCaret(editor, "foo");

    expect(editor.getText()).toBe("{{foo}}");
    expect(getNoteReferenceAutocompleteContext(editor)?.query).toBe("foo");
    expect(isNoteReferenceAutocompleteOpen(editor)).toBe(true);
  });

  it("dismisses on ESC", () => {
    const editor = makeEditor("{{foo}}");
    editor.commands.setTextSelection(5);
    expect(isNoteReferenceAutocompleteOpen(editor)).toBe(true);

    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(isNoteReferenceAutocompleteOpen(editor)).toBe(false);
  });

  it("dismisses on space and no longer opens for that block", () => {
    const editor = makeEditor("{{foo}}");
    editor.commands.setTextSelection(6);

    const handled = editor.view.someProp("handleTextInput", (handler) =>
      handler(
        editor.view,
        editor.state.selection.from,
        editor.state.selection.from,
        " ",
        () => editor.state.tr,
      ),
    );
    insertAtCaret(editor, " ");

    expect(handled).toBeFalsy();
    expect(editor.getText()).toBe("{{foo }}");
    expect(getNoteReferenceAutocompleteContext(editor)).toBeNull();
  });
});

describe("note reference autocomplete insertion", () => {
  it("replaces the brace block with a noteReference atom", () => {
    const editor = makeEditor("Before {{foo}} after");
    // Caret inside `foo`: paragraph starts at 1, "Before " is 7 chars,
    // "{{" is 2 -> query starts at 10; put the caret after "foo".
    editor.commands.setTextSelection(13);

    const context = getNoteReferenceAutocompleteContext(editor);
    expect(context).not.toBeNull();
    insertNoteReferenceFromAutocomplete(editor, context!, "note-42");

    const references: Array<{ noteId: string; section: string }> = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "noteReference") {
        references.push({
          noteId: String(node.attrs.noteId),
          section: String(node.attrs.section),
        });
      }
    });

    expect(references).toEqual([{ noteId: "note-42", section: "" }]);
    expect(editor.getText()).not.toContain("foo");
    expect(editor.getMarkdown()).toContain("{{@note-42}}");
    expect(editor.getMarkdown()).toContain("Before ");
    expect(editor.getMarkdown()).toContain(" after");
  });
});
