// Tier 1 tests for `SlashCommandMenu`'s `extraCommands` integration.
//
// Goal: prove that the parent can inject slash commands without
// touching the static command set, and that `clearSlashLine` is
// available for the dynamic commands to call.
//
// We never render the React component itself, so we mock
// `@mui/material` (it transitively pulls in
// `react-transition-group/TransitionGroupContext`, which Vitest's
// node resolver cannot handle). The mocked module also satisfies
// any accidental import the file makes under jsdom.
//
// `@vitest-environment jsdom` — Tiptap's `Editor` constructor
// reads `window` while building its initial document; running
// this suite under node throws "no window object available".

// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@mui/material", () => ({
  List: ({ children }: { children?: ReactNode }) => <ul>{children}</ul>,
  ListItemButton: ({
    children,
    onMouseDown,
    onMouseEnter,
  }: {
    children?: ReactNode;
    onMouseDown?: () => void;
    onMouseEnter?: () => void;
  }) => (
    <li onMouseDown={onMouseDown} onMouseEnter={onMouseEnter}>
      {children}
    </li>
  ),
  ListItemText: ({
    primary,
    secondary,
  }: {
    primary?: ReactNode;
    secondary?: ReactNode;
  }) => (
    <span>
      {primary} {secondary}
    </span>
  ),
  ListSubheader: ({ children }: { children?: ReactNode }) => (
    <li>{children}</li>
  ),
  Paper: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  SlashMenuStateExtension,
  clearSlashLine,
  getMatchingSlashCommands,
  isSlashCommandContext,
  setSlashMenuState,
  slashMenuStateKey,
  type SlashCommand,
} from "./SlashCommandMenu";
import { CustomDetails } from "./CustomDetails";
import { DetailsContent, DetailsSummary } from "@tiptap/extension-details";

function makeEditor(): Editor {
  // Build a minimal editor in node mode; the helpers we test only
  // operate on `editor.state.selection.$from`, which exists as soon
  // as the editor is constructed.
  return new Editor({
    extensions: [
      StarterKit,
      CustomDetails,
      DetailsSummary,
      DetailsContent,
      SlashMenuStateExtension,
    ],
  });
}

describe("SlashCommandMenu — extraCommands", () => {
  it("concatenates built-ins and extras without deduping", () => {
    const editor = makeEditor();
    try {
      const extraRun = vi.fn();
      const extras: SlashCommand[] = [
        {
          id: "image",
          label: "Image / Attachment",
          keywords: ["upload", "image"],
          run: extraRun,
        },
      ];

      // Type the slash and verify both built-ins and extras match.
      editor.commands.setContent("<p>/</p>");
      editor.commands.focus("end");

      const matches = getMatchingSlashCommands(editor, extras);
      // every built-in still matches because empty query returns
      // score 0 for all; the extra also matches.
      expect(matches.length).toBeGreaterThan(1);
      expect(matches).toContainEqual(extras[0]);
    } finally {
      editor.destroy();
    }
  });

  it("scores extras against the typed query", () => {
    const editor = makeEditor();
    try {
      const extras: SlashCommand[] = [
        {
          id: "image",
          label: "Image / Attachment",
          keywords: ["upload"],
          run: () => {},
        },
      ];

      editor.commands.setContent("<p>/image</p>");
      editor.commands.focus("end");

      const matches = getMatchingSlashCommands(editor, extras);
      // the extras command's `id` exactly equals the query → 100 pts,
      // so it must be ranked first.
      expect(matches[0]).toBe(extras[0]);
    } finally {
      editor.destroy();
    }
  });

  it("clearSlashLine removes the slash paragraph content", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>/image hello</p>");
      editor.commands.focus("end");

      clearSlashLine(editor);

      // The paragraph content (the typed slash + query) is gone;
      // the document still has the empty paragraph, so we don't
      // assert on doc.isEmpty.
      const text = editor.state.doc.textContent;
      expect(text).toBe("");
    } finally {
      editor.destroy();
    }
  });

  it("/details matches and inserts a details node when typed", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>/details</p>");
      editor.commands.focus("end");

      const matches = getMatchingSlashCommands(editor);
      // id "details" matches query "details" exactly → score 100, top.
      expect(matches[0]?.id).toBe("details");

      matches[0]!.run(editor);

      // After running, the editor should contain a `details` node with
      // summary + content. The slash query "/details" must NOT leak into
      // either summary or content — both should have placeholder text.
      const json = JSON.stringify(editor.getJSON());
      expect(json).toContain('"type":"details"');
      expect(json).toContain('"type":"detailsSummary"');
      expect(json).toContain('"text":"Summary"');
      expect(json).toContain('"text":"Details content"');
      // Slash query must not survive in the doc.
      expect(editor.state.doc.textContent).not.toContain("/details");
    } finally {
      editor.destroy();
    }
  });
});

describe("SlashCommandMenu — inline marker commands", () => {
  // Each of these tests seeds a slash query at the end of an empty
  // paragraph, selects the matching built-in command, and asserts on
  // the inserted marker text + caret position. The fallback path
  // (paragraph text starts with "/") is enough — we don't need to go
  // through the SlashMenuStateExtension here, only via the slash state
  // tests below.

  const inlineCases: Array<{
    query: string;
    expectedMarker: string;
    expectedCaretOffset: number;
    expectedCommandId: string;
  }> = [
    {
      query: "bold",
      expectedMarker: "****",
      expectedCaretOffset: 2,
      expectedCommandId: "bold",
    },
    {
      query: "italic",
      expectedMarker: "**",
      expectedCaretOffset: 1,
      expectedCommandId: "italic",
    },
    {
      query: "strike",
      expectedMarker: "~~~~",
      expectedCaretOffset: 2,
      expectedCommandId: "strike",
    },
    {
      query: "latex",
      expectedMarker: "$$$$",
      expectedCaretOffset: 2,
      expectedCommandId: "latex",
    },
  ];

  for (const tc of inlineCases) {
    it(`/${tc.query} inserts the marker pair and lands the caret in the middle`, () => {
      const editor = makeEditor();
      try {
        editor.commands.setContent(`<p>/${tc.query}</p>`);
        editor.commands.focus("end");

        const matches = getMatchingSlashCommands(editor);
        const top = matches.find((m) => m.id === tc.expectedCommandId);
        expect(top).toBeDefined();

        top!.run(editor);

        // The paragraph text should be exactly the marker — no slash
        // query should leak through.
        const text = editor.state.doc.textContent;
        expect(text).toBe(tc.expectedMarker);

        // The caret should land between the two halves of the marker.
        // We don't assert the absolute position (which depends on
        // document offsets) — instead, compare relative to the inserted
        // marker: from inside the doc, the marker starts at offset 1
        // (the opening `<p>` is at 0, the closing at 1 + marker.length).
        // The caret should be 1 + expectedCaretOffset inside the doc.
        const caretOffset = editor.state.selection.from;
        const expected = 1 + tc.expectedCaretOffset;
        expect(caretOffset).toBe(expected);
      } finally {
        editor.destroy();
      }
    });
  }
});

describe("SlashCommandMenu — slash state tracking", () => {
  it("marks the slash position when the user types `/`", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello</p>");
      editor.commands.focus("end");

      // Simulate typing "/" at the caret by invoking the plugin's
      // handleTextInput directly. We identify our plugin by its
      // exported key — `view.someProp` iterates by priority and
      // doesn't surface "the plugin with this specific key".
      const plugin = editor.state.plugins.find(
        (p) => p.spec.key === slashMenuStateKey,
      );
      if (!plugin) {
        throw new Error("SlashMenuStateExtension plugin not registered");
      }
      const handler = plugin.props.handleTextInput;
      if (typeof handler !== "function") {
        throw new Error(
          "SlashMenuStateExtension plugin has no handleTextInput",
        );
      }
      // Cast to a no-`this` function type so we don't have to
      // provide a `this` binding.
      const plainHandler = handler as (
        view: typeof editor.view,
        from: number,
        to: number,
        text: string,
        deflt: () => unknown,
      ) => boolean | void;
      plainHandler(editor.view, 6, 6, "/", () =>
        editor.state.tr.insertText("/", 6, 6),
      );

      // Insert the "/" for real so the doc text matches reality.
      editor.commands.insertContent("/");

      const state = slashMenuStateKey.getState(editor.state);
      expect(state).toEqual({ pos: 6 });
    } finally {
      editor.destroy();
    }
  });

  it("opens the menu when the slash state is set mid-paragraph", () => {
    const editor = makeEditor();
    try {
      // "hello/" with caret at position 7 (after the slash). Setting
      // the slash state directly is the test-friendly equivalent of
      // the user having typed the slash.
      editor.commands.setContent("<p>hello/</p>");
      editor.commands.focus("end");
      setSlashMenuState(editor, 6);

      expect(isSlashCommandContext(editor)).toBe(true);

      // The query is whatever lives between the slash and the caret —
      // empty here, so all built-ins match with score 0.
      const matches = getMatchingSlashCommands(editor);
      expect(matches.length).toBeGreaterThan(0);
    } finally {
      editor.destroy();
    }
  });

  it("does NOT open the menu when the slash state is set in a different paragraph", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>first/</p><p>second</p>");
      // Caret lives in the second paragraph.
      editor.commands.focus("end");
      // Pretend the user typed "/" inside the first paragraph.
      setSlashMenuState(editor, 6);

      expect(isSlashCommandContext(editor)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("does NOT open the menu when the caret has moved back before the slash", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello/</p>");
      // Caret at position 5 (the "o" before the slash).
      editor.commands.setTextSelection(5);
      // Slash state says "/" was at position 6 — but the caret is now
      // behind it, so the menu should not open.
      setSlashMenuState(editor, 6);

      expect(isSlashCommandContext(editor)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("closes the menu when ESC fires via the plugin", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>hello/</p>");
      editor.commands.focus("end");
      setSlashMenuState(editor, 6);

      expect(isSlashCommandContext(editor)).toBe(true);

      // The plugin registered by SlashMenuStateExtension is the one
      // we want to invoke — `view.someProp("handleKeyDown", ...)`
      // would return whichever plugin registered first (typically
      // starter-kit's keymap), not ours. Find it by its key.
      const plugin = editor.state.plugins.find(
        (p) => p.spec.key === slashMenuStateKey,
      );
      if (!plugin) {
        throw new Error("SlashMenuStateExtension plugin not registered");
      }
      const handler = plugin.props.handleKeyDown;
      if (typeof handler !== "function") {
        throw new Error("SlashMenuStateExtension plugin has no handleKeyDown");
      }
      // Cast to a no-`this` function type so we don't have to
      // provide a `this` binding.
      const plainHandler = handler as (
        view: typeof editor.view,
        event: KeyboardEvent,
      ) => boolean | void;
      plainHandler(
        editor.view,
        new KeyboardEvent("keydown", { key: "Escape" }),
      );

      expect(slashMenuStateKey.getState(editor.state)).toBeNull();
      expect(isSlashCommandContext(editor)).toBe(false);

      // The "/" character itself stays in the doc — ESC only closes
      // the menu, it doesn't undo the slash.
      expect(editor.state.doc.textContent).toBe("hello/");
    } finally {
      editor.destroy();
    }
  });

  it("clearSlashLine clears the slash menu state as well", () => {
    const editor = makeEditor();
    try {
      editor.commands.setContent("<p>/bold</p>");
      editor.commands.focus("end");
      setSlashMenuState(editor, 1);

      clearSlashLine(editor);

      expect(slashMenuStateKey.getState(editor.state)).toBeNull();
    } finally {
      editor.destroy();
    }
  });
});
