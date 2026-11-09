import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useEffect, useRef, useState } from "react";
import {
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";

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

export interface SlashCommand {
  id: string;
  label: string;
  keywords: string[];
  /** Optional command name that reflects the editor's current state. */
  getCommandName?: (editor: Editor) => string;
  run: (editor: Editor) => void | Promise<void>;
}

// Tracks the position of the last "/" the user typed so the slash menu
// can open mid-paragraph, not only on an empty line. Stored as plugin
// state on the editor. `dismissed` is set when the user explicitly
// closes the menu (ESC) or types a character that ends the command
// context (space / a bare "-"); the state is kept (instead of cleared)
// so the text-based fallback in `isSlashCommandContext` cannot re-open
// the menu behind the user's back. Cleared when a command runs.
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
              const isSpace = /\s/.test(text);
              const query = view.state.doc.textBetween(
                existing.pos + 1,
                from,
                "\n",
                "\n",
              );
              const isBareHyphen = query.length === 0 && text.includes("-");
              if (isSpace || isBareHyphen) {
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

const getCurrentParagraphRange = (editor: Editor) => {
  // We only replace content in the current paragraph (the slash line).
  const { $from } = editor.state.selection;
  const from = $from.start();
  const to = from + $from.parent.content.size;
  return { from, to };
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
  const { from: paragraphFrom } = getCurrentParagraphRange(editor);
  const textBeforeCaret = doc.textBetween(paragraphFrom, selection.from);
  const commandStart = textBeforeCaret.lastIndexOf("/");
  return commandStart === -1 || !textBeforeCaret.trimStart().startsWith("/")
    ? null
    : { from: paragraphFrom + commandStart, to: selection.from };
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
    run: (editor) => {
      clearSlashLine(editor);
      editor.chain().focus().setCodeBlock().run();
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
): string => command.getCommandName?.(editor) ?? `/${command.id}`;

/**
 * @returns what the user has typed after "/"
 */
const getSlashQuery = (editor: Editor) => {
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
      return doc.textBetween(slashState.pos + 1, selection.from).toLowerCase();
    } catch {
      return "";
    }
  }

  // Fallback for content that already starts with a slash command and has
  // no recorded slash state, such as pasted content or unit-test fixtures.
  const { from: paragraphFrom } = getCurrentParagraphRange(editor);
  const textBeforeCaret = doc.textBetween(paragraphFrom, selection.from);
  const commandStart = textBeforeCaret.lastIndexOf("/");
  if (
    commandStart === -1 ||
    !textBeforeCaret.trimStart().startsWith("/") ||
    selection.from < paragraphFrom + commandStart + 1
  ) {
    return "";
  }
  console.warn(
    "[slash-query] no slash state found, falling back to text search (this is expected for pasted content and unit tests)",
  );
  return textBeforeCaret.slice(commandStart + 1).toLowerCase();
};

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
  const { from: paragraphFrom } = getCurrentParagraphRange(editor);
  const textBeforeCaret = doc.textBetween(paragraphFrom, selection.from);
  return textBeforeCaret.trimStart().startsWith("/");
}

/**
 * Executes the best matching slash command for the current editor context, if any.
 * Usually executed when the user presses Enter or selects it
 * @param editor
 * @returns `true` if a command was executed, `false` otherwise
 */
export function runBestSlashCommand(editor: Editor): boolean {
  // Used for keyboard confirmation: Enter executes the top-ranked command.
  const commands = getMatchingSlashCommands(editor);
  const bestCommand = commands[0];
  if (!bestCommand) {
    return false;
  }

  bestCommand.run(editor);
  return true;
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
        setSelectedIndex((prev) =>
          prev < matchingCommands.length - 1 ? prev + 1 : prev,
        );
      }
    };

    editor.view.dom.addEventListener("keydown", handleKeyDown, true);
    return () => {
      if (editor?.view && !editor.isDestroyed) {
        editor.view.dom.removeEventListener("keydown", handleKeyDown, true);
      }
    };
  }, [editor, enabled, matchingCommands]);

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
      const selectedCommand = matchingCommands[selectedIndex];
      if (!selectedCommand) {
        return;
      }

      event.preventDefault();
      selectedCommand.run(editor);
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
  }, [editor, enabled, matchingCommands, selectedIndex]);

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
              onMouseDown={(event) => {
                event.preventDefault();
                command.run(editor);
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
