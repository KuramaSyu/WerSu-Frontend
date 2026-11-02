// Regression test for the source<->rich round-trip.
//
// Bug: when the ydoc sync handler called setContent while the user
// was in source mode, the editor stayed empty because of an
// early-return guard. The next rich->source toggle then produced
// truncated markdown.
//
// This test reproduces the path through `useActiveNoteStore.setContent`
// (the same gate all load paths go through), with a real Tiptap
// editor underneath. Asserts that all the content survives.

// @vitest-environment jsdom

import "../../../test/setup";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";

import { useActiveNoteStore } from "../../../zustand/editorStore";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { markdownToProsemirror } from "./markdownToProsemirror";

const md = [
  "| ![a](http://x/a.png) | 9/10 |",
  "| --- | --- |",
  "| ![b](http://x/b.png) |  |",
  "| 10/10 |  |",
  "| ![c](http://x/c.png) |  |",
  "| 5/10saftartig |  |",
  "| ![d](http://x/d.png) |  |",
  "| 7/10saftartig |  |",
  "| ![e](http://x/e.png) | 6/10 |",
  "",
  "",
  "![f](http://x/f.png) | 6/10  ",
  "![g](http://x/g.png) | 4/10  ",
  "![h](http://x/h.png) | 9/10  ",
  "![o](http://x/o.png) | 10/10  ",
  "![p](http://x/p.png) | 1/10",
  "",
  "> 5/10?nicht mehr in Erinnerung  ",
  "> ![q](http://x/q.png) | 10/10  ",
  "> ![r](http://x/r.png) | 1/10",
  "",
].join("\n");

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        undoRedo: false,
      }),
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Markdown,
    ],
  });
}

beforeEach(() => {
  // Reset store + settings to a known state. The setup file already
  // snapshots zustand stores between tests, but those snapshots are
  // taken from the *first* test that imports the store, so we
  // explicitly reset here too.
  useEditorSettings.setState({ editMode: false, viewMode: "rich" });
  useActiveNoteStore.setState({
    noteId: undefined,
    editor: null,
    ydoc: null,
    title: "",
    sourceMarkdown: "",
    isSaving: false,
    onNoteUpdated: null,
  });
});

afterEach(() => {
  // Tear the editor down so the next test starts fresh.
  const editor = useActiveNoteStore.getState().editor;
  if (editor && !editor.isDestroyed) {
    editor.destroy();
  }
});

describe("useActiveNoteStore.setContent", () => {
  it("loads the editor even when viewMode is 'source' (regression)", async () => {
    // Simulate the ydoc sync firing while the user happens to be in
    // source mode (e.g. they toggled quickly after open).
    useEditorSettings.setState({ viewMode: "source" });

    const editor = makeEditor();
    useActiveNoteStore.setState({ editor });

    // Initial load (the ydoc sync path uses setContent(note.content)).
    useActiveNoteStore.getState().setContent(md);

    // Microtask for setContent -> editor.commands.setContent.
    await Promise.resolve();
    await Promise.resolve();

    // User toggles rich -> source. SpeedDial uses editor.getMarkdown().
    const roundTripped = editor.getMarkdown();

    expect(roundTripped).toContain("![f](http://x/f.png)");
    expect(roundTripped).toContain("nicht mehr in Erinnerung");
    expect(roundTripped).toContain("![q](http://x/q.png)");
    // The table itself should also be intact.
    expect(roundTripped).toContain("| ![a](http://x/a.png) | 9/10 |");
  });
});

describe("useActiveNoteStore.seedSourceMarkdown", () => {
  it("lets the note load into the editor when it resolves after mount (cache miss)", async () => {
    // Cache-miss ordering: the editor mounts while `useNote` is still
    // pending, so `setEditor` (which resets the write dedupe) has
    // already run. The note then arrives and the source-sync effect
    // mirrors its markdown *before* the seed effect calls setContent.
    const editor = makeEditor();
    useActiveNoteStore.getState().setEditor(editor);

    // Source-sync effect mirrors the late note. It must not mark the
    // markdown as already written, or the seed below gets deduped.
    useActiveNoteStore.getState().seedSourceMarkdown("# loaded late");
    useActiveNoteStore.getState().setContent("# loaded late");

    await Promise.resolve();
    await Promise.resolve();

    expect(editor.getMarkdown()).toContain("loaded late");
  });
});

describe("useActiveNoteStore.setContent (source -> rich)", () => {
  // Regression: `setSourceMarkdown` updates the write memo, so leaving
  // source mode used to be deduped and the user's source edits never
  // reached the rich editor until they pressed save. `force` bypasses
  // the dedupe for that explicit intent.
  it("applies source edits to the editor when forced", async () => {
    const editor = makeEditor();
    useActiveNoteStore.getState().setEditor(editor);
    useActiveNoteStore.getState().setContent("# rich original");
    await Promise.resolve();
    await Promise.resolve();

    // User edits in source mode; the memo now claims the edited markdown.
    useActiveNoteStore.getState().setSourceMarkdown("# edited in source");

    // Leaving source passes `force` (see useEditorModeShortcuts).
    useActiveNoteStore.getState().setContent("# edited in source", true);
    await Promise.resolve();
    await Promise.resolve();

    expect(editor.getMarkdown()).toContain("edited in source");
  });

  it("still dedupes an unforced repeat write", async () => {
    const editor = makeEditor();
    useActiveNoteStore.getState().setEditor(editor);
    useActiveNoteStore.getState().setContent("# rich original");
    await Promise.resolve();
    await Promise.resolve();

    // The source buffer claims a different markdown but nothing forces
    // the write, so the editor keeps its current content.
    useActiveNoteStore.getState().setSourceMarkdown("# edited in source");
    useActiveNoteStore.getState().setContent("# edited in source");
    await Promise.resolve();
    await Promise.resolve();

    expect(editor.getMarkdown()).toContain("rich original");
    expect(editor.getMarkdown()).not.toContain("edited in source");
  });
});

describe("markdownToProsemirror (sanity)", () => {
  it("returns a doc with the after-table content", () => {
    const editor = makeEditor();
    const doc = markdownToProsemirror(editor, md);
    const types = (doc.content ?? []).map((n) => n.type);
    expect(types).toContain("table");
    expect(types).toContain("paragraph");
    expect(types).toContain("blockquote");
  });
});
