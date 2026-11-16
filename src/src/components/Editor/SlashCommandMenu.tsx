import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";
import { useEffect, useRef, useState } from "react";
import { useTheme, type Theme } from "@mui/material/styles";
import {
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import { SUPPORTED_LANGUAGES, lowlight } from "./lowlight";
import {
  EMPTY_SLASH_COMMAND_ARGUMENTS,
  createSlashCommandArguments,
  type SlashCommand,
} from "./slashCommandTypes";
import { SlashCommandComposerController } from "./SlashCommandComposer";
import { insertMermaidBlock } from "./mermaid/mermaidBlock";

// Re-export the public slash-command API from the menu module so existing
// importers keep working while the types live in a dependency-free module
// (the composer imports them too, which would otherwise be a cycle).
export type {
  SlashCommand,
  SlashCommandArgument,
  SlashCommandArgumentAutocomplete,
  SlashCommandArgumentOption,
  SlashCommandArguments,
  SlashCommandAutocompleteContext,
} from "./slashCommandTypes";
export {
  EMPTY_SLASH_COMMAND_ARGUMENTS,
  createSlashCommandArguments,
} from "./slashCommandTypes";

interface SlashCommandMenuProps {
  editor: Editor;
  enabled?: boolean;
  /**
   * Commands injected by the parent component (e.g. commands that need
   * access to React hooks like `useDialog()`). Concatenated with the
   * built-in static command set; user-typed `/` queries search both.
   */
  extraCommands?: SlashCommand[];
}

// Tracks the position of the last "/" the user typed so the slash menu
// can open mid-paragraph, not only on an empty line. Stored as plugin
// state on the editor. `dismissed` is set when the user explicitly
// closes the menu (ESC) or types a character that ends the command
// context (whitespace / a bare "-"); the state is kept (instead of
// cleared) so the text-based fallback in `isSlashCommandContext` cannot
// re-open the menu behind the user's back. Cleared when a command runs.
type SlashMenuState = { pos: number; dismissed: boolean } | null;

type SlashMenuMeta =
  | { type: "set"; pos: number }
  | { type: "dismiss" }
  | { type: "clear" };

export const slashMenuStateKey = new PluginKey<SlashMenuState>(
  "slashMenuState",
);

// `@tiptap/react`'s FloatingMenu only re-runs `shouldShow` on transactions
// that change the document or selection, so a meta-only dismissal (ESC)
// would not hide it. The floating-menu plugin listens on every transaction
// for this key with the string value "hide", so we pass the same key to
// `<FloatingMenu pluginKey={...}>` below and reuse it to force a hide.
export const slashMenuFloatingKey = new PluginKey("slashMenuFloating");

/** Dismisses the slash menu and forces the floating menu to hide. */
const dismissSlashMenu = (view: EditorView) => {
  const tr = view.state.tr
    .setMeta(slashMenuStateKey, { type: "dismiss" })
    .setMeta(slashMenuFloatingKey, "hide");
  view.dispatch(tr);
};

// Tiptap extension: register alongside the other editor extensions so the
// slash menu state lives on the editor regardless of which React component
// is currently rendering.
export const SlashMenuStateExtension = Extension.create({
  name: "slashMenuState",

  addProseMirrorPlugins() {
    return [
      new Plugin<SlashMenuState>({
        key: slashMenuStateKey,
        state: {
          init() {
            return null;
          },
          apply(tr, value) {
            // Explicit set/clear via tr.setMeta wins over any inherited value.
            const meta = tr.getMeta(slashMenuStateKey) as
              | SlashMenuMeta
              | undefined;
            if (meta) {
              if (meta.type === "set") {
                return { pos: meta.pos, dismissed: false };
              }
              if (meta.type === "dismiss") {
                return value ? { ...value, dismissed: true } : null;
              }
              if (meta.type === "clear") {
                return null;
              }
            }
            return value;
          },
        },
        props: {
          // Detect "/" typed by the user and remember where it landed so
          // the menu can keep filtering as more characters are typed
          // after it.
          handleTextInput(view, from, to, text) {
            const slashIdx = text.indexOf("/");
            if (slashIdx !== -1) {
              const slashPos = from + slashIdx;
              const tr = view.state.tr.setMeta(slashMenuStateKey, {
                type: "set",
                pos: slashPos,
              });
              view.dispatch(tr);
              return false;
            }

            // Closing the menu without deleting the typed "/".
            //   - whitespace ends the command word (e.g. "/bold "),
            //   - a bare "-" directly after the slash is not a command
            //     trigger, so it must not open / keep the menu.
            const existing = slashMenuStateKey.getState(view.state);
            if (existing && !existing.dismissed && from >= existing.pos + 1) {
              const isWhitespace = /\s/.test(text);
              const query = view.state.doc.textBetween(
                existing.pos + 1,
                from,
                "\n",
                "\n",
              );
              const isBareHyphen = query.length === 0 && text.includes("-");
              if (isWhitespace || isBareHyphen) {
                dismissSlashMenu(view);
              }
            }
            return false;
          },
          // ESC closes the slash menu without removing the typed "/".
          // We don't preventDefault so other handlers can still react
          // to the keypress.
          handleKeyDown(view, event) {
            if (event.key === "Escape") {
              const existing = slashMenuStateKey.getState(view.state);
              if (existing && !existing.dismissed) {
                dismissSlashMenu(view);
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

/**
 * Test / programmatic hook: directly set or clear the slash menu state.
 * Production code does not need this — the plugin's handleTextInput
 * handles live typing. Useful for unit tests that want to assert on
 * menu behavior without going through the input event.
 */
export const setSlashMenuState = (editor: Editor, pos: number | null): void => {
  const meta: SlashMenuMeta =
    pos === null ? { type: "clear" } : { type: "set", pos };
  const tr = editor.state.tr.setMeta(slashMenuStateKey, meta);
  editor.view.dispatch(tr);
};

/** Active Discord-style argument composer. */
export interface SlashCommandComposerState {
  /** Document position of the slash that started the command. */
  from: number;
  /** Document position right after the canonical `/command` text. */
  to: number;
  controller: SlashCommandComposerController;
}

type SlashCommandComposerMeta =
  | { type: "open"; state: SlashCommandComposerState }
  | { type: "close" };

export const slashCommandComposerKey =
  new PluginKey<SlashCommandComposerState | null>("slashCommandComposer");

/**
 * Renders the argument composer as a widget decoration right after the
 * `/command` text, so the chips sit inline exactly where the user is
 * composing the command. The composer is ephemeral: it never becomes part
 * of the document (or collaboration state).
 */
export const SlashCommandComposerExtension = Extension.create({
  name: "slashCommandComposer",

  addProseMirrorPlugins() {
    return [
      new Plugin<SlashCommandComposerState | null>({
        key: slashCommandComposerKey,
        state: {
          init() {
            return null;
          },
          apply(tr, value) {
            const meta = tr.getMeta(slashCommandComposerKey) as
              | SlashCommandComposerMeta
              | undefined;
            if (meta) {
              return meta.type === "open" ? meta.state : null;
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const composer = slashCommandComposerKey.getState(state);
            if (!composer) {
              return null;
            }
            return DecorationSet.create(state.doc, [
              Decoration.widget(composer.to, composer.controller.element, {
                side: 1,
                key: "slash-command-composer",
              }),
            ]);
          },
        },
      }),
    ];
  },

  onDestroy() {
    const composer = slashCommandComposerKey.getState(this.editor.state);
    composer?.controller.dispose();
  },
});

/**
 * Opens the argument composer for a command that declares arguments.
 *
 * The typed query is replaced with the canonical `/command-id` text, the
 * slash menu is dismissed, and the composer widget is inserted after the
 * command name. Returns `false` when the command has no arguments or the
 * slash context is gone.
 */
export const openSlashCommandComposer = (
  editor: Editor,
  command: SlashCommand,
  theme?: Theme,
): boolean => {
  if (!command.arguments || command.arguments.length === 0) {
    return false;
  }
  const slashState = slashMenuStateKey.getState(editor.state);
  if (!slashState || slashState.dismissed) {
    return false;
  }
  const from = slashState.pos;
  const to = editor.state.selection.from;
  if (to < from + 1) {
    return false;
  }

  const commandText = `/${command.id}`;
  const replaceTr = editor.state.tr
    .insertText(commandText, from, to)
    .setMeta(slashMenuStateKey, { type: "dismiss" })
    .setMeta(slashMenuFloatingKey, "hide");
  editor.view.dispatch(replaceTr);

  const end = from + commandText.length;
  const controller = new SlashCommandComposerController(
    editor,
    command,
    end,
    theme,
    {
      onExecute: (values, omittedArguments) => {
        clearSlashCommandComposer(editor);
        void command.run(
          editor,
          createSlashCommandArguments(command, values, omittedArguments),
        );
      },
      onCancel: (reason) => {
        clearSlashCommandComposer(editor);
        if (reason === "dismiss") {
          // Explicitly backing out (Escape/Backspace) must return focus to
          // the editor. Clicking elsewhere already moved the selection.
          editor.chain().focus().setTextSelection(end).run();
        }
      },
    },
  );
  editor.view.dispatch(
    editor.state.tr.setMeta(slashCommandComposerKey, {
      type: "open",
      state: { from, to: end, controller },
    }),
  );
  return true;
};

/** Closes an open argument composer without changing the document text. */
export const clearSlashCommandComposer = (editor: Editor): void => {
  const composer = slashCommandComposerKey.getState(editor.state);
  if (!composer) {
    return;
  }
  composer.controller.dispose();
  editor.view.dispatch(
    editor.state.tr.setMeta(slashCommandComposerKey, { type: "close" }),
  );
};

const getCurrentParagraphRange = (editor: Editor) => {
  // We only replace content in the current paragraph (the slash line).
  const { $from } = editor.state.selection;
  const from = $from.start();
  const to = from + $from.parent.content.size;
  return { from, to };
};

/**
 * Fallback for content that already contains a slash command but has no
 * recorded slash state (pasted content, unit-test fixtures).
 *
 * Only a slash that is the first non-whitespace character of its text
 * block counts as a command, and the query may not contain whitespace.
 * Without these guards a code block whose content merely *starts* with a
 * slash (`// comment`, a path, or a JSX closing tag like `</Modal>`) would
 * open the menu from any caret position, because the old check only looked
 * at the beginning of the block.
 */
const getFallbackSlashRange = (
  editor: Editor,
): { from: number; to: number } | null => {
  const { selection, doc } = editor.state;
  const { from: paragraphFrom } = getCurrentParagraphRange(editor);
  const textBeforeCaret = doc.textBetween(paragraphFrom, selection.from);
  const commandStart = textBeforeCaret.lastIndexOf("/");
  if (commandStart === -1) {
    return null;
  }
  // The slash must be the block's first non-whitespace character: only
  // whitespace may precede it. Everything else (`//`, `a / b`, `</Modal>`)
  // is ordinary content, not a command.
  if (textBeforeCaret.slice(0, commandStart).trim().length > 0) {
    return null;
  }
  // A command query is a single word; whitespace ends the context.
  if (/\s/.test(textBeforeCaret.slice(commandStart + 1))) {
    return null;
  }
  return { from: paragraphFrom + commandStart, to: selection.from };
};

const getSlashCommandRange = (
  editor: Editor,
): { from: number; to: number } | null => {
  const { selection, doc } = editor.state;
  const slashState = slashMenuStateKey.getState(editor.state);
  if (slashState) {
    try {
      const $slash = doc.resolve(slashState.pos);
      const $cursor = selection.$from;
      if (
        $slash.parent !== $cursor.parent ||
        selection.from < slashState.pos + 1 ||
        selection.to < slashState.pos + 1
      ) {
        return null;
      }
      return { from: slashState.pos, to: selection.from };
    } catch {
      return null;
    }
  }

  // Fallback for content that already starts with a slash command and has
  // no recorded slash state, such as pasted content or unit-test fixtures.
  return getFallbackSlashRange(editor);
};

/**
 * Removes the entire current paragraph before applying a block command.
 * Exported so dynamically-injected commands can share this behavior.
 */
export const clearSlashLine = (editor: Editor) => {
  const range = getCurrentParagraphRange(editor);
  editor.chain().focus().deleteRange(range).run();
  // Also clear the slash menu state so the floating menu closes.
  const tr = editor.state.tr.setMeta(slashMenuStateKey, { type: "clear" });
  editor.view.dispatch(tr);
};

/** Removes only the typed slash command and preserves surrounding text. */
export const clearSlashCommand = (editor: Editor) => {
  const range = getSlashCommandRange(editor);
  if (!range) {
    return;
  }

  editor.chain().focus().deleteRange(range).run();
  const tr = editor.state.tr.setMeta(slashMenuStateKey, { type: "clear" });
  editor.view.dispatch(tr);
};

const slashCommands: SlashCommand[] = [
  {
    id: "table",
    label: "Table",
    keywords: ["table", "grid"],
    run: (editor) => {
      clearSlashLine(editor);
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    id: "bullet-point",
    label: "Bullet list",
    keywords: ["bullet", "bullet-point", "list", "unordered"],
    run: (editor) => {
      clearSlashLine(editor);
      editor.chain().focus().toggleBulletList().run();
    },
  },
  {
    id: "enumerate",
    label: "Numbered list",
    keywords: ["enumerate", "numbered", "ordered", "list"],
    run: (editor) => {
      clearSlashLine(editor);
      editor.chain().focus().toggleOrderedList().run();
    },
  },
  {
    id: "heading-1",
    label: "Heading 1",
    keywords: ["heading", "h1", "title"],
    run: (editor) => {
      clearSlashLine(editor);
      editor.chain().focus().setHeading({ level: 1 }).run();
    },
  },
  {
    id: "heading-2",
    label: "Heading 2",
    keywords: ["heading", "h2", "subtitle"],
    run: (editor) => {
      clearSlashLine(editor);
      editor.chain().focus().setHeading({ level: 2 }).run();
    },
  },
  {
    id: "heading-3",
    label: "Heading 3",
    keywords: ["heading", "h3"],
    run: (editor) => {
      clearSlashLine(editor);
      editor.chain().focus().setHeading({ level: 3 }).run();
    },
  },
  {
    id: "codeblock",
    label: "Code block",
    keywords: ["code", "codeblock", "snippet"],
    arguments: [
      {
        name: "language",
        description: "Language used for syntax highlighting.",
        required: false,
        defaultValue: "plaintext",
        autocomplete: SUPPORTED_LANGUAGES.map((language) => ({
          value: language,
          label: language,
        })),
      },
    ],
    run: (editor, args) => {
      const requested = args?.value("language")?.trim().toLowerCase();
      // Fall back to plaintext for missing or unknown languages: an
      // unregistered language would make CodeBlockLowlight run the
      // expensive `highlightAuto` path on every render.
      const language =
        requested && lowlight.registered(requested)
          ? requested
          : "plaintext";
      clearSlashLine(editor);
      editor.chain().focus().setCodeBlock({ language }).run();
    },
  },
  {
    id: "mermaid",
    label: "Mermaid diagram",
    keywords: ["mermaid", "diagram", "flowchart", "graph", "chart", "sequence"],
    run: (editor) => {
      clearSlashLine(editor);
      // No composer argument: the diagram body is edited inside the block
      // itself, where the live preview renders next to the source.
      insertMermaidBlock(editor);
    },
  },
  {
    id: "details",
    label: "Details (collapsible)",
    keywords: ["details", "disclosure", "collapse", "expand", "summary"],
    run: (editor) => {
      clearSlashLine(editor);
      // Always insert a complete details node with both summary and
      // body. `setDetails()` would wrap the empty paragraph but leave
      // summary empty and content holding the slash query — not what
      // users want when invoking this command.
      editor
        .chain()
        .focus()
        .insertContent({
          type: "details",
          content: [
            {
              type: "detailsSummary",
              content: [{ type: "text", text: "Summary" }],
            },
            {
              type: "detailsContent",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Details content" }],
                },
              ],
            },
          ],
        })
        .run();
    },
  },
  {
    id: "cite",
    label: "Cite",
    keywords: ["cite", "quote", "blockquote", "citation"],
    run: (editor) => {
      clearSlashLine(editor);
      editor.chain().focus().setBlockquote().run();
    },
  },
  {
    id: "bold",
    label: "Bold",
    keywords: ["bold", "strong", "**"],
    getCommandName: (editor) =>
      editor.isActive("bold") ? "/bold off" : "/bold",
    run: (editor) => {
      const wasActive = editor.isActive("bold");
      clearSlashCommand(editor);
      if (wasActive) {
        editor.chain().focus().unsetBold().run();
      } else {
        editor.chain().focus().setBold().run();
      }
    },
  },
  {
    id: "italic",
    label: "Italic",
    keywords: ["italic", "emphasis", "em", "*"],
    getCommandName: (editor) =>
      editor.isActive("italic") ? "/italic off" : "/italic",
    run: (editor) => {
      const wasActive = editor.isActive("italic");
      clearSlashCommand(editor);
      if (wasActive) {
        editor.chain().focus().unsetItalic().run();
      } else {
        editor.chain().focus().setItalic().run();
      }
    },
  },
  {
    id: "strike",
    label: "Strikethrough",
    keywords: ["strike", "strikethrough", "deleted", "~~"],
    getCommandName: (editor) =>
      editor.isActive("strike") ? "/strike off" : "/strike",
    run: (editor) => {
      const wasActive = editor.isActive("strike");
      clearSlashCommand(editor);
      if (wasActive) {
        editor.chain().focus().unsetStrike().run();
      } else {
        editor.chain().focus().setStrike().run();
      }
    },
  },
];

/** Returns the command name shown beneath a slash command label. */
export const getSlashCommandName = (
  editor: Editor,
  command: SlashCommand,
): string => {
  const name = command.getCommandName?.(editor) ?? `/${command.id}`;
  const argumentHint = (command.arguments ?? [])
    .map((argument) =>
      argument.required ? `<${argument.name}>` : `[${argument.name}]`,
    )
    .join(" ");
  return argumentHint ? `${name} ${argumentHint}` : name;
};

/**
 * @returns the raw text the user has typed after "/"
 */
const getRawSlashQuery = (editor: Editor) => {
  const { selection, doc } = editor.state;

  // Prefer the slash state set by the SlashMenuStateExtension when
  // the user typed "/" — this allows the menu to open mid-paragraph
  // and gives a stable anchor that survives further typing.
  const slashState = slashMenuStateKey.getState(editor.state);
  if (slashState) {
    // A dismissed menu (ESC, space, bare "-") must not expose a query,
    // even when the block still starts with the typed "/".
    if (slashState.dismissed) {
      return "";
    }
    try {
      const $slash = doc.resolve(slashState.pos);
      const $cursor = selection.$from;
      // The slash and caret must be in the same text block. Structured
      // editor contexts (lists, tables, and code blocks) remain supported.
      if ($slash.parent !== $cursor.parent) {
        return "";
      }
      // The selection must start at or after the query's first character.
      // This still prevents a stale menu from appearing after navigating
      // elsewhere, even when the selection spans text.
      if (
        selection.from < slashState.pos + 1 ||
        selection.to < slashState.pos + 1
      ) {
        return "";
      }
      return doc.textBetween(slashState.pos + 1, selection.from);
    } catch {
      return "";
    }
  }

  // Fallback for content that already starts with a slash command and has
  // no recorded slash state, such as pasted content or unit-test fixtures.
  const fallbackRange = getFallbackSlashRange(editor);
  if (!fallbackRange) {
    return "";
  }
  console.warn(
    "[slash-query] no slash state found, falling back to text search (this is expected for pasted content and unit tests)",
  );
  return doc.textBetween(fallbackRange.from + 1, selection.from);
};

/**
 * @returns the command word typed after "/", lowercased
 */
const getSlashQuery = (editor: Editor) =>
  getRawSlashQuery(editor).trim().toLowerCase();

/**
 * @returns a score how much the command matches the current query.
 * Scores go from -1 (no match) to 100 (perfect match)
 */
const getSlashCommandScore = (command: SlashCommand, query: string) => {
  // Higher score means "better" match for Enter-to-select behavior.
  if (!query) {
    return 0;
  }

  if (command.id === query) {
    return 100;
  }

  if (command.id.startsWith(query)) {
    return 80;
  }

  if (command.label.toLowerCase().startsWith(query)) {
    return 70;
  }

  if (command.keywords.some((keyword) => keyword === query)) {
    return 60;
  }

  if (command.keywords.some((keyword) => keyword.startsWith(query))) {
    return 50;
  }

  if (command.label.toLowerCase().includes(query)) {
    return 40;
  }

  if (command.id.includes(query)) {
    return 30;
  }

  if (command.keywords.some((keyword) => keyword.includes(query))) {
    return 20;
  }

  return -1;
};

/**
 * @param editor
 * @param extraCommands optional dynamic commands injected by the parent
 * @returns slash commands that match the current query, sorted by score.
 */
export function getMatchingSlashCommands(
  editor: Editor,
  extraCommands: SlashCommand[] = [],
): SlashCommand[] {
  // Stable sort by score, then by declaration order for deterministic first item.
  const query = getSlashQuery(editor);

  // Built-ins first so their declaration order wins ties with extras.
  return [...slashCommands, ...extraCommands]
    .map((command, index) => ({
      command,
      score: getSlashCommandScore(command, query),
      index,
    }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.index - b.index;
    })
    .map((item) => item.command);
}

/**
 * Determines whether a slash command query is currently reachable.
 *
 * Commands are intentionally allowed in tables, lists, code blocks, and
 * with text selected. The only validity checks are that the slash and
 * caret/selection are in the same text block and that the query can be
 * read from the document.
 *
 * @param editor The ProseMirror editor instance to check
 * @returns `true` if slash commands can be displayed, `false` otherwise
 */
export function isSlashCommandContext(editor: Editor): boolean {
  const { selection, doc } = editor.state;
  const slashState = slashMenuStateKey.getState(editor.state);

  if (slashState) {
    // Explicitly dismissed (ESC / space / bare "-"): stay hidden until
    // the next "/" re-arms the menu, even though the block still starts
    // with a "/" that the fallback below would otherwise match.
    if (slashState.dismissed) {
      return false;
    }
    try {
      const $slash = doc.resolve(slashState.pos);
      const $cursor = selection.$from;
      if (
        $slash.parent !== $cursor.parent ||
        selection.from < slashState.pos + 1 ||
        selection.to < slashState.pos + 1
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  // Fallback for content that already starts with a slash command and has
  // no recorded slash state, such as pasted content or unit-test fixtures.
  return getFallbackSlashRange(editor) !== null;
}

/**
 * Runs a command, or opens its argument composer when it declares
 * arguments. Shared by the menu keyboard/mouse handlers and
 * `runBestSlashCommand`.
 */
export function activateSlashCommand(
  editor: Editor,
  command: SlashCommand,
  theme?: Theme,
): boolean {
  if (command.arguments && command.arguments.length > 0) {
    return openSlashCommandComposer(editor, command, theme);
  }
  void command.run(editor, EMPTY_SLASH_COMMAND_ARGUMENTS);
  return true;
}

/**
 * Executes the best matching slash command for the current editor context, if any.
 * Usually executed when the user presses Enter or selects it
 * @param editor
 * @returns `true` if a command was executed, `false` otherwise
 */
export function runBestSlashCommand(editor: Editor): boolean {
  if (!isSlashCommandContext(editor)) {
    return false;
  }
  // Used for keyboard confirmation: Enter activates the top-ranked command.
  const commands = getMatchingSlashCommands(editor);
  const bestCommand = commands[0];
  if (!bestCommand) {
    return false;
  }

  return activateSlashCommand(editor, bestCommand);
}

/**
 * Whether an ArrowUp/ArrowDown keypress should be consumed by the slash
 * command menu. The menu may only steal the arrow keys while it is
 * actually open; otherwise the keys must fall through to ProseMirror's
 * default caret movement (including inside code blocks).
 *
 * Exported as a pure predicate so the guard can be regression-tested
 * without mounting the `FloatingMenu` render tree.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function shouldHandleSlashMenuArrowKey(
  editor: Editor,
  enabled: boolean,
): boolean {
  return enabled && editor.isEditable && isSlashCommandContext(editor);
}

export const SlashCommandMenu = ({
  editor,
  enabled = true,
  extraCommands = [],
}: SlashCommandMenuProps) => {
  // The app's ThemeProvider is above this component; the argument composer
  // is mounted in a separate React root as a ProseMirror widget, so pass
  // the active theme along explicitly.
  const theme = useTheme();
  // Keep `extraCommands` accessible to the selector closure without making
  // the selector referentially unstable on every render — the ref is
  // mutated in an effect, so the selector identity stays stable.
  const extraCommandsRef = useRef<SlashCommand[]>(extraCommands);
  useEffect(() => {
    extraCommandsRef.current = extraCommands;
  }, [extraCommands]);

  const { matchingCommands, displayedCommands } = useEditorState({
    editor,
    selector: (ctx) => {
      const matchingCommands = getMatchingSlashCommands(
        ctx.editor,
        extraCommandsRef.current,
      );
      return {
        matchingCommands,
        displayedCommands: matchingCommands.map((command) => ({
          command,
          commandName: getSlashCommandName(ctx.editor, command),
        })),
      };
    },
  });
  // Index of the currently highlighted command for keyboard navigation.
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keep the highlighted item visible while navigating with the arrow
  // keys. The list has a fixed max height, so without this the selection
  // can move off-screen inside the scroll container.
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // keyboard navigation: arrow up/down to change selectedIndex
  useEffect(() => {
    if (!editor?.view || editor.isDestroyed) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      // Only steal the arrow keys when the menu is actually open. The
      // listener is capture-phase and mounted for the editor's whole
      // lifetime, so an unconditional `preventDefault()` here would
      // swallow every vertical caret movement in the document (the
      // default ProseMirror arrow-up/down keymap lives on `keydown`).
      // Note: the fallback branch in `isSlashCommandContext` also keeps
      // the menu open for pasted content that starts with `/`.
      if (!shouldHandleSlashMenuArrowKey(editor, enabled)) {
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else {
        event.preventDefault();
        const count = getMatchingSlashCommands(editor).length;
        setSelectedIndex((prev) => (prev < count - 1 ? prev + 1 : prev));
      }
    };

    editor.view.dom.addEventListener("keydown", handleKeyDown, true);
    return () => {
      if (editor?.view && !editor.isDestroyed) {
        editor.view.dom.removeEventListener("keydown", handleKeyDown, true);
      }
    };
  }, [editor, enabled]);

  // keyboard navigation: Enter or Tab to execute the selected command
  useEffect(() => {
    if (!editor?.view || editor.isDestroyed) {
      return;
    }
    const handleEnterSelection = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== "Tab") {
        return;
      }

      if (!enabled || !editor.isEditable || !isSlashCommandContext(editor)) {
        return;
      }

      // Most relevant command is always the first after scoring/sorting.
      // Compute the matches from the *current* editor state instead of the
      // React render closure: the last typed character and Tab can land in
      // the same tick, before `useEditorState` has re-rendered the menu.
      const currentMatches = getMatchingSlashCommands(editor);
      const selectedCommand =
        currentMatches[
          Math.min(selectedIndex, Math.max(0, currentMatches.length - 1))
        ];
      if (!selectedCommand) {
        return;
      }

      event.preventDefault();
      activateSlashCommand(editor, selectedCommand, theme);
    };

    // register listener
    editor.view.dom.addEventListener("keydown", handleEnterSelection, true);

    // clear listener on unmount
    return () => {
      // without this check, the page will go grey
      if (editor?.view && !editor.isDestroyed) {
        editor.view.dom.removeEventListener(
          "keydown",
          handleEnterSelection,
          true,
        );
      }
    };
  }, [editor, enabled, selectedIndex, theme]);

  // clear index when commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [matchingCommands]);

  return (
    <FloatingMenu
      editor={editor}
      pluginKey={slashMenuFloatingKey}
      options={{ placement: "bottom-start", offset: 8, flip: true }}
      shouldShow={() =>
        enabled && editor.isEditable && isSlashCommandContext(editor)
      }
    >
      <Paper
        elevation={1}
        sx={{
          minWidth: 220,
          maxWidth: 320,
          py: 1,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            textTransform: "uppercase",
            px: 2,
            pb: 1,
            color: "textPrimary",
          }}
        >
          Slash Commands
        </Typography>
        <List
          dense
          disablePadding
          component={"nav"}
          sx={{
            maxHeight: 300,
            overflowY: "scroll",

            // Scrollbar
            scrollbarWidth: "none",
            // currently not used since scrollbar is none, but also a good option with "thin" as scrollbarWidth
            // scrollbarColor: (theme) =>
            //   `${theme.palette.action.disabled} ${theme.palette.background.paper}`,
          }}
        >
          {displayedCommands.map(({ command, commandName }, i) => (
            <ListItemButton
              key={command.id}
              ref={i === selectedIndex ? selectedItemRef : undefined}
              onMouseDown={(event) => {
                event.preventDefault();
                activateSlashCommand(editor, command, theme);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
              sx={{
                px: 0,
                m: 0,
                backgroundColor:
                  i === selectedIndex ? "action.selected" : undefined,
              }}
            >
              <ListItemText
                sx={{ pl: 2, m: 0 }}
                primary={command.label}
                secondary={commandName}
              />
            </ListItemButton>
          ))}
          {matchingCommands.length === 0 && (
            <ListItemButton disabled>
              <ListItemText primary="No matching commands" />
            </ListItemButton>
          )}
        </List>
      </Paper>
    </FloatingMenu>
  );
};
