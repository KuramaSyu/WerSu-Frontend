import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import { useEffect, useState } from "react";
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
}

interface SlashCommand {
  id: string;
  label: string;
  keywords: string[];
  run: (editor: Editor) => void;
}

const getCurrentParagraphRange = (editor: Editor) => {
  // We only replace content in the current paragraph (the slash line).
  const { $from } = editor.state.selection;
  const from = $from.start();
  const to = from + $from.parent.content.size;
  return { from, to };
};

const clearSlashLine = (editor: Editor) => {
  // Remove "/..." before inserting/toggling the selected block command.
  const range = getCurrentParagraphRange(editor);
  editor.chain().focus().deleteRange(range).run();
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
];

/**
 * @returns what the user has typed after "/"
 */
const getSlashQuery = (editor: Editor) => {
  // Slash commands only work for a collapsed caret selection.
  const { selection } = editor.state;
  if (!selection.empty) {
    return "";
  }

  // if "/" was not typed first, then nothing
  const text = selection.$from.parent.textContent.trimStart();
  if (!text.startsWith("/")) {
    return "";
  }

  return text.slice(1).toLowerCase();
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
 * @returns slash commands that match the current query, sorted by score.
 */
function getMatchingSlashCommands(editor: Editor): SlashCommand[] {
  // Stable sort by score, then by declaration order for deterministic first item.
  const query = getSlashQuery(editor);

  return slashCommands
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
 * Determines whether the current editor context allows displaying slash commands.
 *
 * Slash commands are only shown when:
 * - No text is currently selected
 * - The cursor is not in a structured editing block (table, list, code block)
 * - The cursor is within a paragraph
 * - The paragraph content (trimmed) starts with a forward slash "/"
 *
 * @param editor The ProseMirror editor instance to check
 * @returns `true` if the context is valid for showing slash commands, `false` otherwise
 */
export function isSlashCommandContext(editor: Editor): boolean {
  // Do not show slash commands when selecting text.
  const { selection } = editor.state;
  if (!selection.empty) {
    return false;
  }

  if (
    // Do not show slash commands in block types with their own structured editing.
    editor.isActive("table") ||
    editor.isActive("bulletList") ||
    editor.isActive("orderedList") ||
    editor.isActive("taskList") ||
    editor.isActive("codeBlock")
  ) {
    return false;
  }

  const { $from } = selection;
  if ($from.parent.type.name !== "paragraph") {
    return false;
  }

  return $from.parent.textContent.trimStart().startsWith("/");
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

export const SlashCommandMenu = ({
  editor,
  enabled = true,
}: SlashCommandMenuProps) => {
  const { matchingCommands } = useEditorState({
    editor,
    selector: (ctx) => {
      return {
        matchingCommands: getMatchingSlashCommands(ctx.editor),
      };
    },
  });
  // Index of the currently highlighted command for keyboard navigation.
  const [selectedIndex, setSelectedIndex] = useState(0);

  // keyboard navigation: arrow up/down to change selectedIndex
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev < matchingCommands.length - 1 ? prev + 1 : prev,
        );
      }
    };

    editor.view.dom.addEventListener("keydown", handleKeyDown, true);
    return () => {
      editor.view.dom.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [editor, matchingCommands]);

  // keyboard navigation: Enter or Tab to execute the selected command
  useEffect(() => {
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
      editor.view.dom.removeEventListener(
        "keydown",
        handleEnterSelection,
        true,
      );
    };
  }, [editor, enabled, matchingCommands, selectedIndex]);

  // clear index when commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [matchingCommands]);

  return (
    <FloatingMenu
      editor={editor}
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
        <Typography variant="caption" sx={{ px: 1.5, color: "text.secondary" }}>
          Slash commands
        </Typography>

        <List
          dense
          disablePadding
          sx={{
            display: "flex",
            flexDirection: "column",
            maxHeight: 300,
            overflow: "scroll",
          }}
        >
          {matchingCommands.map((command, i) => (
            <ListItemButton
              key={command.id}
              onMouseDown={(event) => {
                event.preventDefault();
                command.run(editor);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
              sx={{
                backgroundColor:
                  i === selectedIndex ? "action.selected" : undefined,
              }}
            >
              <ListItemText
                primary={command.label}
                secondary={`/${command.id}`}
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
