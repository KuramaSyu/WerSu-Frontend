// Round-trip guard for `{{@note-id#section}}` tokens. The raw target
// must survive markdown -> ProseMirror -> markdown; resolved content
// must never be serialized into the note.

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, describe, expect, it } from "vitest";
import { Editor, generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

import { NoteReference } from "./NoteReference";
import {
  buildNoteReferenceHref,
  extractNoteSections,
  findNoteReference,
  findNoteSection,
  formatNoteReferenceToken,
  isNoteReferenceAccessDenied,
  normalizeNoteSectionSlug,
  noteReferenceLookupKey,
  parseNoteReferenceToken,
} from "../../utils/noteReferences";

const editors: Editor[] = [];

function editorWith(markdown: string): Editor {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false, undoRedo: false }),
      NoteReference,
      Markdown,
    ],
  });
  editors.push(editor);
  editor.commands.setContent(markdown, { contentType: "markdown" });
  return editor;
}

function collectReferences(editor: Editor) {
  const refs: Array<{ noteId: string; section: string }> = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "noteReference") {
      refs.push({
        noteId: String(node.attrs.noteId ?? ""),
        section: String(node.attrs.section ?? ""),
      });
    }
  });
  return refs;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe("NoteReference markdown parsing", () => {
  it("parses section and whole-note tokens inline", () => {
    const editor = editorWith(
      "See {{@note-2#details}} and {{@note-3}} for context.",
    );

    expect(collectReferences(editor)).toEqual([
      { noteId: "note-2", section: "details" },
      { noteId: "note-3", section: "" },
    ]);
    expect(editor.getText()).toContain("See ");
    expect(editor.getText()).toContain(" for context.");
  });

  it("round-trips the raw token unchanged", () => {
    const markdown = "See {{@note-2#details}} and {{@note-3}}.";
    expect(editorWith(markdown).getMarkdown()).toContain(markdown);
  });

  it("keeps multiple references in the same paragraph distinct", () => {
    const editor = editorWith("{{@a#one}}{{@b#two}}");
    const refs = collectReferences(editor);
    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({ noteId: "a", section: "one" });
    expect(refs[1]).toEqual({ noteId: "b", section: "two" });
  });
});

describe("note reference helpers", () => {
  it("parses explicit and implicit sections", () => {
    expect(parseNoteReferenceToken("{{@note-1#details}}")).toEqual({
      noteId: "note-1",
      section: "details",
    });
    expect(parseNoteReferenceToken("{{@note-1}}")).toEqual({
      noteId: "note-1",
      section: "",
    });
    expect(parseNoteReferenceToken("not a token")).toBeNull();
  });

  it("formats canonical tokens", () => {
    expect(formatNoteReferenceToken("n", "s")).toBe("{{@n#s}}");
    expect(formatNoteReferenceToken("n", "")).toBe("{{@n}}");
  });

  it("matches lookups by note id + section (or bare note id)", () => {
    expect(noteReferenceLookupKey("n", "s")).toBe("n#s");
    expect(noteReferenceLookupKey("n", "")).toBe("n");

    const references = [
      { note_id: "n", section: "s", content: "section" },
      { note_id: "m", section: "", content: "whole note" },
    ];
    expect(findNoteReference(references, "n", "s")?.content).toBe("section");
    expect(findNoteReference(references, "m", "")?.content).toBe("whole note");
    expect(findNoteReference(references, "n", "")).toBeUndefined();
  });

  it("detects the backend permission error", () => {
    expect(
      isNoteReferenceAccessDenied(
        "Error: user has no permission to view the referenced note",
      ),
    ).toBe(true);
    expect(isNoteReferenceAccessDenied("Allowed content")).toBe(false);
  });

  it("builds the in-app link with an encoded section", () => {
    expect(buildNoteReferenceHref("note 1", "a b")).toBe(
      "/n/note%201?section=a%20b",
    );
    expect(buildNoteReferenceHref("note-1", "")).toBe("/n/note-1");
  });
});


describe("note section extraction", () => {
  const markdown = [
    "# Intro",
    "Welcome.",
    "",
    "## Details",
    "Detailed **body**.",
    "",
    "### Nested",
    "Nested body.",
    "",
    "# Next",
    "Second section.",
    "",
    "```md",
    "# Not a heading",
    "```",
  ].join("\n");

  it("parses heading titles, unique slugs, and full section markdown", () => {
    const sections = extractNoteSections(markdown);
    expect(sections.map((section) => section.slug)).toEqual([
      "intro",
      "details",
      "nested",
      "next",
    ]);
    expect(sections.map((section) => section.level)).toEqual([1, 2, 3, 1]);

    const details = sections.find((section) => section.slug === "details");
    expect(details?.title).toBe("Details");
    expect(details?.markdown).toContain("## Details");
    expect(details?.markdown).toContain("Nested body.");
    expect(details?.markdown).not.toContain("# Next");
    expect(details?.content).not.toContain("## Details");
  });

  it("does not treat headings inside fenced code blocks as sections", () => {
    expect(extractNoteSections(markdown).map((section) => section.title)).not.toContain(
      "Not a heading",
    );
  });

  it("parses setext headings too", () => {
    const sections = extractNoteSections(
      "Title\n=====\nBody\n\nSub\n---\nMore",
    );
    expect(sections.map((section) => section.slug)).toEqual(["title", "sub"]);
    expect(sections.map((section) => section.level)).toEqual([1, 2]);
  });

  it("removes inline markdown from heading titles before slugging", () => {
    const sections = extractNoteSections("## **Bold** and [linked](https://x)");
    expect(sections[0].title).toBe("Bold and linked");
    expect(sections[0].slug).toBe("bold-and-linked");
  });

  it("finds a section with a leading # and normalizes slugs", () => {
    expect(findNoteSection(markdown, "#details")?.title).toBe("Details");
    expect(normalizeNoteSectionSlug("  ###details  ")).toBe("details");
    expect(findNoteSection(markdown, "missing")).toBeUndefined();
  });
});


describe("section markdown rendering", () => {
  it("parses a section through the editor markdown manager and serializes ProseMirror nodes", () => {
    const editor = editorWith(
      [
        "# Note",
        "Intro",
        "",
        "## Details",
        "",
        "Some **bold** text.",
        "",
        "- one",
        "- two",
      ].join("\n"),
    );
    const section = findNoteSection(editor.getMarkdown(), "details");
    expect(section).toBeDefined();

    const json = editor.storage.markdown.manager.parse(section!.markdown);
    const html = generateHTML(json, editor.extensionManager.baseExtensions);

    expect(html).toContain("<h2>Details</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<ul>");
    expect(html).not.toContain("# Note");
  });
});
