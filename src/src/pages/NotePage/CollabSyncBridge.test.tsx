// Tier 2 tests for the collaboration sync bridge.
//
// The bridge owns one rule that matters for data safety: the Y.Doc is
// the live state of a note, so the *saved* markdown may only seed a
// doc the server has no state for. Writing the saved version into a
// doc that already holds live content resets the live doc to the last
// saved version every time the editor mounts.
//
// The tests below pin that rule against a real Y.Doc. The provider is
// a stub that emits `synced`, and the store's editor is a stub whose
// schema is a minimal ProseMirror schema, so the seed really lands in
// the doc's XmlFragment.
//
// @vitest-environment jsdom

import "../../test/setup";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import * as Y from "yjs";
import { Schema } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { CollabSyncBridge } from "./CollabSyncBridge";
import { useActiveNoteStore } from "../../zustand/editorStore";

/** Minimal ProseMirror schema: a doc with paragraphs and text. */
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      content: "inline*",
      group: "block",
      toDOM: () => ["p", 0],
    },
    text: { group: "inline" },
  },
});

/**
 * Editor stub. `storage.markdown.manager.parse` is what the store
 * uses to turn markdown into ProseMirror JSON, so the stub returns a
 * single paragraph holding the raw markdown.
 */
function createStubEditor(markdown: string): Editor {
  return {
    schema,
    isDestroyed: false,
    storage: {
      markdown: {
        manager: {
          parse: (input: string) => ({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: input ? [{ type: "text", text: input }] : [],
              },
            ],
          }),
        },
      },
    },
    commands: { setContent: vi.fn() },
    getMarkdown: () => markdown,
  } as unknown as Editor;
}

/** Provider stub: an event emitter plus the `synced` flag. */
class FakeProvider {
  synced = false;
  disconnect = vi.fn();
  private listeners = new Map<string, Set<() => void>>();

  on(event: string, handler: () => void) {
    const handlers = this.listeners.get(event) ?? new Set();
    handlers.add(handler);
    this.listeners.set(event, handlers);
    return this;
  }

  off(event: string, handler: () => void) {
    this.listeners.get(event)?.delete(handler);
    return this;
  }

  emit(event: string) {
    this.listeners.get(event)?.forEach((handler) => handler());
  }
}

/** Put a paragraph with `text` into the doc, the way a peer edit would. */
function putLiveContent(ydoc: Y.Doc, text: string) {
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.insert(0, [new Y.XmlText(text)]);
  ydoc.getXmlFragment("default").insert(0, [paragraph]);
}

describe("CollabSyncBridge", () => {
  let ydoc: Y.Doc;
  let provider: FakeProvider;
  let editor: Editor;

  beforeEach(() => {
    ydoc = new Y.Doc();
    provider = new FakeProvider();
    editor = createStubEditor("");
    // setEditor also resets the store's write dedupe, so every test
    // starts with a clean slate.
    useActiveNoteStore.getState().setEditor(editor);
    useActiveNoteStore.getState().setYDoc(ydoc);
    useActiveNoteStore.getState().setSourceMarkdown("# saved version");
  });

  const renderBridge = () =>
    render(
      <CollabSyncBridge
        editor={editor}
        ydoc={ydoc}
        provider={provider as unknown as HocuspocusProvider}
        editMode
        noteId="note-1"
      />,
    );

  it("keeps the live doc content when the server has state for it", () => {
    putLiveContent(ydoc, "live content");
    provider.synced = true;

    renderBridge();

    // The doc still holds the live content - the saved markdown was
    // not written over it.
    const fragment = ydoc.getXmlFragment("default");
    expect(fragment.length).toBe(1);
    expect(fragment.toString()).toContain("live content");
    expect(fragment.toString()).not.toContain("saved version");
  });

  it("does not seed before the first sync landed", () => {
    provider.synced = false;

    renderBridge();

    expect(ydoc.getXmlFragment("default").length).toBe(0);
  });

  it("seeds an empty doc with the saved markdown once the sync landed", () => {
    provider.synced = false;
    renderBridge();

    provider.synced = true;
    provider.emit("synced");

    const fragment = ydoc.getXmlFragment("default");
    expect(fragment.length).toBe(1);
    expect(fragment.toString()).toContain("# saved version");
  });

  it("does not re-seed a doc the user emptied on purpose", () => {
    putLiveContent(ydoc, "live content");
    provider.synced = true;
    renderBridge();

    // The user cleared the note. A reconnect must not resurrect the
    // saved markdown.
    ydoc.getXmlFragment("default").delete(0, 1);
    provider.emit("synced");

    expect(ydoc.getXmlFragment("default").length).toBe(0);
  });

  it("seeds an empty doc when the sync landed before the bridge mounted", () => {
    provider.synced = true;

    renderBridge();

    const fragment = ydoc.getXmlFragment("default");
    expect(fragment.length).toBe(1);
    expect(fragment.toString()).toContain("# saved version");
  });

  it("seeds a doc with the markdown that arrives after the sync", () => {
    provider.synced = false;
    renderBridge();

    // The note markdown lands after the handshake.
    useActiveNoteStore.getState().setSourceMarkdown("# late arrival");
    provider.synced = true;
    provider.emit("synced");

    const fragment = ydoc.getXmlFragment("default");
    expect(fragment.length).toBe(1);
    expect(fragment.toString()).toContain("# late arrival");
  });
});
