// @vitest-environment jsdom

// Clipboard helpers: selection extraction, formatted write with
// fallback, copy/cut, and the text + image paste paths.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  copyToClipboard: vi.fn(async () => true),
  // Tests that want a "current editor" install one here. Mocked so the
  // module never touches yjs or tiptap.
  activeEditor: { editor: null as unknown },
}));

const { copyToClipboard, activeEditor } = mocks;

vi.mock("../../zustand/InfoStore", () => ({
  copyToClipboard: mocks.copyToClipboard,
}));

vi.mock("../../zustand/editorStore", () => ({
  useActiveNoteStore: {
    getState: () => mocks.activeEditor,
  },
}));

// getSelectionHtml only needs a serializer, so keep the real
// prosemirror graph out of the test.
vi.mock("prosemirror-model", () => ({
  DOMSerializer: {
    fromSchema: () => ({
      serializeFragment: () => document.createTextNode("serialized-html"),
    }),
  },
}));

import {
  copyEditorSelection,
  currentEditor,
  cutEditorSelection,
  getSelectionHtml,
  getSelectionText,
  pasteIntoEditor,
  writeFormattedClipboard,
} from "./editorClipboard";

interface FakeEditor {
  isEditable: boolean;
  schema: unknown;
  state: {
    selection: { from: number; to: number };
    doc: {
      textBetween: ReturnType<typeof vi.fn>;
      slice: ReturnType<typeof vi.fn>;
    };
  };
  view: { pasteText: ReturnType<typeof vi.fn> };
  chain: ReturnType<typeof vi.fn>;
}

function makeEditor(overrides: Partial<FakeEditor> = {}): FakeEditor {
  const run = vi.fn(() => true);
  const deleteSelection = vi.fn(() => ({ run }));
  const uploadAttachment = vi.fn(() => ({ run }));
  const focus = vi.fn(() => ({ deleteSelection, uploadAttachment }));
  const chain = vi.fn(() => ({ focus }));

  return {
    isEditable: true,
    schema: {},
    state: {
      selection: { from: 1, to: 5 },
      doc: {
        textBetween: vi.fn(() => "hello"),
        slice: vi.fn(() => ({})),
      },
    },
    view: { pasteText: vi.fn() },
    chain,
    ...overrides,
  };
}

// Replace navigator.clipboard wholesale so tests never touch the real one.
function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  activeEditor.editor = null;
  setClipboard(undefined);
  // jsdom has no ClipboardItem; make the default fallback explicit.
  vi.stubGlobal("ClipboardItem", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getSelectionText", () => {
  it("returns empty string for a collapsed selection", () => {
    const editor = makeEditor();
    editor.state.selection = { from: 3, to: 3 };
    expect(getSelectionText(editor as never)).toBe("");
  });

  it("returns the selected text otherwise", () => {
    const editor = makeEditor();
    expect(getSelectionText(editor as never)).toBe("hello");
    expect(editor.state.doc.textBetween).toHaveBeenCalledWith(1, 5, "\n\n");
  });
});

describe("getSelectionHtml", () => {
  it("serialises the selection", () => {
    const editor = makeEditor();
    expect(getSelectionHtml(editor as never)).toBe("serialized-html");
  });

  it("returns empty string for a collapsed selection", () => {
    const editor = makeEditor();
    editor.state.selection = { from: 2, to: 2 };
    expect(getSelectionHtml(editor as never)).toBe("");
  });
});

describe("writeFormattedClipboard", () => {
  it("falls back to copyToClipboard when ClipboardItem is unavailable", async () => {
    await expect(writeFormattedClipboard("<p>x</p>", "x")).resolves.toBe(true);
    expect(copyToClipboard).toHaveBeenCalledWith("x");
  });

  it("writes both html and text when the async API is present", async () => {
    const write = vi.fn(async () => {});
    setClipboard({ write });
    vi.stubGlobal("ClipboardItem", class {});

    await expect(writeFormattedClipboard("<p>x</p>", "x")).resolves.toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(copyToClipboard).not.toHaveBeenCalled();
  });
});

describe("copyEditorSelection", () => {
  it("returns false without an editor", async () => {
    await expect(copyEditorSelection(null)).resolves.toBe(false);
  });

  it("uses the active editor when none is passed", async () => {
    const editor = makeEditor();
    activeEditor.editor = editor;
    expect(currentEditor()).toBe(editor);
    await copyEditorSelection();
    expect(copyToClipboard).toHaveBeenCalledWith("hello");
  });
});

describe("cutEditorSelection", () => {
  it("copies then deletes the selection", async () => {
    const editor = makeEditor();
    await expect(cutEditorSelection(editor as never)).resolves.toBe(true);
    expect(copyToClipboard).toHaveBeenCalledWith("hello");
    expect(editor.chain).toHaveBeenCalled();
  });

  it("refuses on a read-only editor", async () => {
    const editor = makeEditor({ isEditable: false });
    await expect(cutEditorSelection(editor as never)).resolves.toBe(false);
    expect(editor.chain).not.toHaveBeenCalled();
  });
});

describe("pasteIntoEditor", () => {
  it("returns false without an editable editor", async () => {
    await expect(pasteIntoEditor(null)).resolves.toBe(false);
    await expect(
      pasteIntoEditor(makeEditor({ isEditable: false }) as never),
    ).resolves.toBe(false);
  });

  it("pastes text from the clipboard", async () => {
    const readText = vi.fn(async () => "pasted text");
    setClipboard({ readText });
    const editor = makeEditor();

    await expect(pasteIntoEditor(editor as never)).resolves.toBe(true);
    expect(editor.view.pasteText).toHaveBeenCalledWith("pasted text");
  });

  it("uploads the first clipboard image", async () => {
    const getType = vi.fn(
      async () => new Blob(["bytes"], { type: "image/png" }),
    );
    setClipboard({
      readText: vi.fn(async () => ""),
      read: vi.fn(async () => [{ types: ["image/png"], getType }]),
    });
    const editor = makeEditor();

    await expect(pasteIntoEditor(editor as never)).resolves.toBe(true);
    expect(getType).toHaveBeenCalledWith("image/png");
    expect(editor.chain).toHaveBeenCalled();
  });

  it("still returns true for text when read() is denied", async () => {
    setClipboard({
      readText: vi.fn(async () => "text"),
      read: vi.fn(async () => {
        throw new Error("denied");
      }),
    });
    const editor = makeEditor();

    await expect(pasteIntoEditor(editor as never)).resolves.toBe(true);
    expect(editor.view.pasteText).toHaveBeenCalledWith("text");
  });
});
