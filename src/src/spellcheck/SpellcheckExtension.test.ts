// @vitest-environment jsdom

// Wiring test: a real Tiptap editor plus the plugin, driven through
// the store. No dictionary is loaded; a fake checker stands in.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { SPELLCHECK_PLUGIN_KEY, SpellcheckExtension } from "./SpellcheckExtension";
import { __setSpellCheckerForTests, type SpellChecker } from "./dictionary";
import { useSpellcheckStore } from "./spellcheckStore";
import { findMisspelledWordAtPos } from "./suggestions";

const fakeChecker: SpellChecker = {
  check: (word) => word !== "Wlet",
  suggest: () => ["Welt", "Wett"],
};

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit, SpellcheckExtension],
    content: "<p>Hallo Wlet</p>",
  });
}

function decorationsOf(editor: Editor) {
  const state = SPELLCHECK_PLUGIN_KEY.getState(editor.state);
  return state ? state.decorations.find(0, editor.state.doc.content.size) : [];
}

describe("SpellcheckExtension", () => {
  beforeEach(() => {
    __setSpellCheckerForTests("en", fakeChecker);
    useSpellcheckStore.getState().reset();
  });

  it("decorates misspelled words once enabled", async () => {
    const editor = makeEditor();
    try {
      useSpellcheckStore
        .getState()
        .configure({ enabled: true, language: "en" });

      await vi.waitFor(() => {
        expect(decorationsOf(editor)).toHaveLength(1);
      });

      const [decoration] = decorationsOf(editor);
      expect(editor.state.doc.textBetween(decoration.from, decoration.to)).toBe(
        "Wlet",
      );
    } finally {
      editor.destroy();
    }
  });

  it("clears decorations when disabled", async () => {
    const editor = makeEditor();
    try {
      useSpellcheckStore
        .getState()
        .configure({ enabled: true, language: "en" });
      await vi.waitFor(() => {
        expect(decorationsOf(editor)).toHaveLength(1);
      });

      useSpellcheckStore.getState().reset();
      await vi.waitFor(() => {
        expect(decorationsOf(editor)).toHaveLength(0);
      });
    } finally {
      editor.destroy();
    }
  });

  it("resolves the flagged word under a document position", async () => {
    const editor = makeEditor();
    try {
      useSpellcheckStore
        .getState()
        .configure({ enabled: true, language: "en" });
      await vi.waitFor(() => {
        expect(decorationsOf(editor)).toHaveLength(1);
      });

      // "Hallo " occupies 1..7, so the typo starts at position 7.
      expect(findMisspelledWordAtPos(editor, 8)).toEqual({
        from: 7,
        to: 11,
        word: "Wlet",
      });
      expect(findMisspelledWordAtPos(editor, 3)).toBeNull();
    } finally {
      editor.destroy();
    }
  });
});