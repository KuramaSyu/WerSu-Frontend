// @vitest-environment jsdom

// Section reference helper: map a document position to the heading
// section that owns it, and build the `{{@note-id#section}}` token.

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { collectHeadingEntries } from "../pages/NotePage/headingIds";
import {
  buildSectionReferenceToken,
  headingSlugAtPos,
} from "./sectionReference";

let editor: Editor | null = null;

function makeEditor(): Editor {
  editor = new Editor({
    extensions: [StarterKit],
    content:
      "<p>Intro</p><h1>First</h1><p>a</p><h2>Second part</h2><p>b</p>",
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("headingSlugAtPos", () => {
  it("returns no section for content before the first heading", () => {
    const instance = makeEditor();
    expect(headingSlugAtPos(instance.state.doc, 1)).toBe("");
  });

  it("returns the heading owning the position", () => {
    const instance = makeEditor();
    const [first, second] = collectHeadingEntries(instance.state.doc);

    expect(headingSlugAtPos(instance.state.doc, first.pos)).toBe("first");
    expect(headingSlugAtPos(instance.state.doc, first.end + 1)).toBe("first");
    expect(headingSlugAtPos(instance.state.doc, second.pos)).toBe(
      "second-part",
    );
    expect(headingSlugAtPos(instance.state.doc, second.end + 1)).toBe(
      "second-part",
    );
  });
});

describe("buildSectionReferenceToken", () => {
  it("omits the section for the note's global content", () => {
    const instance = makeEditor();
    expect(buildSectionReferenceToken("note-1", instance.state.doc, 1)).toBe(
      "{{@note-1}}",
    );
  });

  it("includes the section slug when inside a heading section", () => {
    const instance = makeEditor();
    const [first] = collectHeadingEntries(instance.state.doc);
    expect(
      buildSectionReferenceToken("note-1", instance.state.doc, first.pos),
    ).toBe("{{@note-1#first}}");
  });

  it("returns an empty token without a note id", () => {
    const instance = makeEditor();
    expect(buildSectionReferenceToken("   ", instance.state.doc, 1)).toBe("");
  });
});