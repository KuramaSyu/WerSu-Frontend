import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import { useEffect } from "react";
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

const getSlashQuery = (editor: Editor) => {
  // Slash commands only work for a collapsed caret selection.
  const { selection } = editor.state;
  if (!selection.empty) {
    return "";
  }

  const text = selection.$from.parent.textContent.trimStart();
  if (!text.startsWith("/")) {
    return "";
  }

  return text.slice(1).toLowerCase();
};

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

const getMatchingSlashCommands = (editor: Editor) => {
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
};

export const isSlashCommandContext = (editor: Editor) => {
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
};

export const runBestSlashCommand = (editor: Editor) => {
  // Used for keyboard confirmation: Enter executes the top-ranked command.
  const commands = getMatchingSlashCommands(editor);
  const bestCommand = commands[0];
  if (!bestCommand) {
    return false;
  }

  bestCommand.run(editor);
  return true;
};

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

  useEffect(() => {
    const handleEnterSelection = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== "Tab") {
        return;
      }

      if (!enabled || !editor.isEditable || !isSlashCommandContext(editor)) {
        return;
      }

      // Most relevant command is always the first after scoring/sorting.
      const bestCommand = matchingCommands[0];
      if (!bestCommand) {
        return;
      }

      event.preventDefault();
      bestCommand.run(editor);
    };

    editor.view.dom.addEventListener("keydown", handleEnterSelection, true);
    return () => {
      editor.view.dom.removeEventListener(
        "keydown",
        handleEnterSelection,
        true,
      );
    };
  }, [editor, enabled, matchingCommands]);

  return (
    <FloatingMenu
      editor={editor}
      options={{ placement: "bottom-start", offset: 8, flip: true }}
      shouldShow={() =>
        enabled && editor.isEditable && isSlashCommandContext(editor)
      }
    >
      <Paper elevation={1} sx={{ minWidth: 220, maxWidth: 320, py: 0.5 }}>
        <Typography variant="caption" sx={{ px: 1.5, color: "text.secondary" }}>
          Slash commands
        </Typography>

        <List dense disablePadding>
          {matchingCommands.map((command) => (
            <ListItemButton
              key={command.id}
              onMouseDown={(event) => {
                event.preventDefault();
                command.run(editor);
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
