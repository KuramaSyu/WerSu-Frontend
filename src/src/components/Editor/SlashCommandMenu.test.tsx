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
  clearSlashLine,
  getMatchingSlashCommands,
  type SlashCommand,
} from "./SlashCommandMenu";

function makeEditor(): Editor {
  // Build a minimal editor in node mode; the helpers we test only
  // operate on `editor.state.selection.$from`, which exists as soon
  // as the editor is constructed.
  return new Editor({
    extensions: [StarterKit],
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
});
