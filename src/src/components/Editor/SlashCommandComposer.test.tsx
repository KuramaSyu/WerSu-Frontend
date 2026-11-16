// @vitest-environment jsdom

import "../../test/setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { SlashCommandComposer } from "./SlashCommandComposer";
import type { SlashCommandComposerController } from "./SlashCommandComposer";
import type { SlashCommand, SlashCommandArguments } from "./slashCommandTypes";
import {
  SlashCommandComposerExtension,
  SlashCommandMenu,
  SlashMenuStateExtension,
  clearSlashLine,
  openSlashCommandComposer,
  setSlashMenuState,
  slashCommandComposerKey,
} from "./SlashCommandMenu";

const makeController = (
  command: SlashCommand,
  callbacks: { execute?: (values: Record<string, string>) => void; cancel?: () => void } = {},
) =>
  ({
    command,
    editor: {},
    anchorPos: 1,
    execute: callbacks.execute ?? vi.fn(),
    cancel: callbacks.cancel ?? vi.fn(),
  }) as unknown as SlashCommandComposerController;

describe("SlashCommandComposer", () => {
  it("renders one chip per argument and focuses the first input", async () => {
    const command: SlashCommand = {
      id: "test",
      label: "Test",
      keywords: [],
      arguments: [
        { name: "language", required: true },
        { name: "title" },
      ],
      run: () => {},
    };
    render(<SlashCommandComposer controller={makeController(command)} />);

    await waitFor(() =>
      expect(screen.getByLabelText("language")).toHaveFocus(),
    );
    expect(screen.getByText("language *")).toBeInTheDocument();
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  it("blocks Enter until required arguments have values", () => {
    const execute = vi.fn();
    const command: SlashCommand = {
      id: "test",
      label: "Test",
      keywords: [],
      arguments: [{ name: "language", required: true }],
      run: () => {},
    };
    render(
      <SlashCommandComposer
        controller={makeController(command, { execute })}
      />,
    );

    const input = screen.getByLabelText("language");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(execute).not.toHaveBeenCalled();
    expect(screen.getByText(/Please enter a value/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "javascript" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(execute).toHaveBeenCalledWith({ language: "javascript" }, []);
  });

  it("uses a default value to satisfy a required argument", () => {
    const execute = vi.fn();
    const command: SlashCommand = {
      id: "test",
      label: "Test",
      keywords: [],
      arguments: [{ name: "language", required: true, defaultValue: "plaintext" }],
      run: () => {},
    };
    render(
      <SlashCommandComposer
        controller={makeController(command, { execute })}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText("language"), { key: "Enter" });
    expect(execute).toHaveBeenCalledWith({}, []);
  });

  it("shows static autocomplete options and selects with Enter", async () => {
    const execute = vi.fn();
    const command: SlashCommand = {
      id: "test",
      label: "Test",
      keywords: [],
      arguments: [
        {
          name: "language",
          autocomplete: [
            { value: "javascript", label: "JavaScript" },
            { value: "python", label: "Python" },
          ],
        },
      ],
      run: () => {},
    };
    render(
      <SlashCommandComposer
        controller={makeController(command, { execute })}
      />,
    );

    const input = screen.getByLabelText("language");
    await waitFor(() => expect(screen.getByText("JavaScript")).toBeInTheDocument());

    fireEvent.change(input, { target: { value: "pyt" } });
    await waitFor(() => expect(screen.getByText("Python")).toBeInTheDocument());
    expect(screen.queryByText("JavaScript")).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(input).toHaveValue("python"));

    // Suggestions are dismissed after the sole argument was chosen.
    fireEvent.keyDown(input, { key: "Enter" });
    expect(execute).toHaveBeenCalledWith({ language: "python" }, []);
  });

  it("supports asynchronous autocomplete callbacks", async () => {
    const autocomplete = vi.fn(async ({ query }: { query: string }) =>
      [{ value: "note-1", label: `Note ${query}` }],
    );
    const command: SlashCommand = {
      id: "test",
      label: "Test",
      keywords: [],
      arguments: [{ name: "note", autocomplete: autocomplete as never }],
      run: () => {},
    };
    render(<SlashCommandComposer controller={makeController(command)} />);

    const input = screen.getByLabelText("note");
    fireEvent.change(input, { target: { value: "abc" } });

    await waitFor(() => expect(autocomplete).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Note abc")).toBeInTheDocument());
  });

  it("cancels when Backspace is pressed in an empty first argument", () => {
    const cancel = vi.fn();
    const command: SlashCommand = {
      id: "test",
      label: "Test",
      keywords: [],
      arguments: [{ name: "language" }],
      run: () => {},
    };
    render(
      <SlashCommandComposer
        controller={makeController(command, { cancel })}
      />,
    );

    const input = screen.getByLabelText("language");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(cancel).toHaveBeenCalled();
  });

  it("completes /co to /codeblock on Tab using the live editor state", async () => {
    // FloatingMenu measures its anchor through `Range` APIs that jsdom
    // does not implement.
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: () => {},
    });
    const rect = {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    };
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [rect],
    });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });

    const editor = new Editor({
      extensions: [
        StarterKit,
        SlashMenuStateExtension,
        SlashCommandComposerExtension,
      ],
    });
    try {
      const theme = createTheme({
        palette: { mode: "dark", primary: { main: "#ff0000" } },
        typography: { fontFamily: "ComposerTestFont" },
      });
      render(
        <ThemeProvider theme={theme}>
          <SlashCommandMenu editor={editor} />
        </ThemeProvider>,
      );
      editor.commands.setContent("<p>/co</p>");
      editor.commands.focus("end");
      setSlashMenuState(editor, 1);

      // Regression: the Tab handler used to read `matchingCommands` from
      // the last React render, which could still be the empty-query list
      // (and therefore run `/table`). It must resolve `/co` now.
      fireEvent.keyDown(editor.view.dom, { key: "Tab" });

      await waitFor(() =>
        expect(editor.state.doc.textContent).toBe("/codeblock"),
      );
      await waitFor(() =>
        expect(
          editor.view.dom.querySelector('input[aria-label="language"]'),
        ).not.toBeNull(),
      );
      // The composer is mounted in its own React root; the active MUI
      // theme must be re-injected there instead of falling back to MUI's
      // default theme.
      const input = editor.view.dom.querySelector(
        'input[aria-label="language"]',
      ) as HTMLInputElement;
      expect(getComputedStyle(input).fontFamily).toContain("ComposerTestFont");
      expect(getComputedStyle(input).caretColor).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
    } finally {
      editor.destroy();
    }
  });

  it("returns focus to the editor when backing out with Backspace", async () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        SlashMenuStateExtension,
        SlashCommandComposerExtension,
      ],
    });
    const editorDom = editor.view.dom;
    document.body.appendChild(editorDom);
    try {
      editor.commands.setContent("<p>/test</p>");
      editor.commands.focus("end");
      setSlashMenuState(editor, 1);

      const command: SlashCommand = {
        id: "test",
        label: "Test",
        keywords: [],
        arguments: [{ name: "language" }],
        run: () => {},
      };
      expect(openSlashCommandComposer(editor, command)).toBe(true);

      await waitFor(() =>
        expect(
          editor.view.dom.querySelector('input[aria-label="language"]'),
        ).not.toBeNull(),
      );
      const input = editor.view.dom.querySelector(
        'input[aria-label="language"]',
      ) as HTMLInputElement;
      await waitFor(() => expect(document.activeElement).toBe(input));
      fireEvent.keyDown(input, { key: "Backspace" });

      await waitFor(() =>
        expect(slashCommandComposerKey.getState(editor.state)).toBeNull(),
      );
      await waitFor(() =>
        expect(document.activeElement).toBe(editor.view.dom),
      );
      expect(editor.state.doc.textContent).toBe("/test");
    } finally {
      editor.destroy();
      editorDom.remove();
    }
  });

  it("opens from the editor, collects values, and executes the command", async () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        SlashMenuStateExtension,
        SlashCommandComposerExtension,
      ],
    });
    try {
      editor.commands.setContent("<p>/test</p>");
      editor.commands.focus("end");
      setSlashMenuState(editor, 1);

      const run = vi.fn(
        (target: Editor, args?: SlashCommandArguments) => {
          void args;
          clearSlashLine(target);
        },
      );
      const command: SlashCommand = {
        id: "test",
        label: "Test",
        keywords: [],
        arguments: [{ name: "name", required: true }],
        run,
      };

      expect(openSlashCommandComposer(editor, command)).toBe(true);
      expect(editor.state.doc.textContent).toBe("/test");

      await waitFor(() =>
        expect(
          editor.view.dom.querySelector('input[aria-label="name"]'),
        ).not.toBeNull(),
      );
      const input = editor.view.dom.querySelector(
        'input[aria-label="name"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "hello" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => expect(run).toHaveBeenCalled());
      const args = run.mock.calls[0][1];
      expect(args?.value("name")).toBe("hello");
      expect(editor.state.doc.textContent).not.toContain("/test");
    } finally {
      editor.destroy();
    }
  });
});