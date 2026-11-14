// Request builders for the editor surface.
//
// These read the editor state at right-click time, so the menu only
// ever shows operations that apply to the element that was hit. No
// React state and no re-renders: the caller invokes these from the
// contextmenu DOM handler.
//
// Every menu entry is a command object (id, label, icon, handler).
// Table commands come from the shared catalogue so the bubble menu and
// the right-click menu can never drift apart.

import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import TableChartIcon from "@mui/icons-material/TableChart";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import FunctionsIcon from "@mui/icons-material/Functions";
import CodeIcon from "@mui/icons-material/Code";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  analyseSelection,
  analyseTableAtPos,
} from "../Editor/BubbleMenus/bubbleMenuStrategies";
import { iconForName } from "../Editor/editorIcons";
import {
  tableCommandsFor,
  type TableCommand,
  type TableCommandId,
} from "../Editor/tableCommands";
import type { EditorContextTarget } from "../Editor/editorContextTarget";
import { useEditorMenuStore } from "../../zustand/editorMenuStore";
import { copyToClipboard } from "../../zustand/InfoStore";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { buildSectionReferenceToken } from "../../utils/sectionReference";
import { copyEditorNode } from "./editorClipboard";
import type { SelectionAnalysisFull } from "../Editor/BubbleMenus/bubbleMenuStrategies";
import type {
  MenuPosition,
  RightClickButtonId,
  RightClickButtonOverride,
  RightClickMenuRequest,
  RightClickMenuRow,
  RightClickSubmenu,
  RightClickSubmenuItem,
} from "./types";

/** Canonical editor rows. Insert is the only built-in submenu trigger. */
const EDITOR_BUTTONS: readonly RightClickButtonId[] = [
  "copy",
  "paste",
  "cut",
  "insert",
];

/** Row / column command groups for the nested table submenus. */
const ROW_COMMAND_IDS: readonly TableCommandId[] = [
  "add-row-before",
  "add-row-after",
  "move-row-up",
  "move-row-down",
  "delete-row",
];
const COLUMN_COMMAND_IDS: readonly TableCommandId[] = [
  "add-column-before",
  "add-column-after",
  "move-column-left",
  "move-column-right",
  "delete-column",
];

/**
 * Build the full request for a right-click inside the editor.
 * Read mode (decision 3) is copy only: paste renders but is greyed out
 * by its canRun probe, and no element rows are requested.
 */
export function buildEditorMenuRequest(
  editor: Editor,
  editMode: boolean,
  position: MenuPosition,
  target?: EditorContextTarget | null,
): RightClickMenuRequest {
  // Available in both modes: the token points at the heading section the
  // user is in (or the whole note when the hit is before the first
  // heading).
  const sectionRows = buildSectionReferenceRows(editor, target);

  if (!editMode) {
    // Read mode has no editing actions, but a right-click on a table
    // should still copy the table itself rather than relying on a text
    // selection the user did not make.
    const overrides =
      target?.kind === "table"
        ? {
            copy: {
              handler: () => {
                void copyEditorNode(editor, target.node);
                return true;
              },
            },
          }
        : undefined;
    return {
      position,
      buttons: ["copy", "paste"],
      overrides,
      extraComponents: sectionRows,
    };
  }

  const analysis = analyseSelection(editor.state);
  const buttons = [...EDITOR_BUTTONS];
  const overrides: Partial<
    Record<RightClickButtonId, RightClickButtonOverride>
  > = {
    // Submenu triggers open on hover; give them a handler so the
    // resolver does not grey them out.
    insert: { handler: () => true },
  };
  const submenus: Partial<Record<RightClickButtonId, RightClickSubmenu>> = {
    insert: buildInsertSubmenu(editor),
  };

  if (target?.kind === "table") {
    // The generic Copy action would be gated on a text selection and
    // disabled for a plain table right-click. Copy the whole table when
    // the pointer hit a table.
    overrides.copy = {
      handler: () => {
        void copyEditorNode(editor, target.node);
        return true;
      },
    };
  }

  const isTable = target ? target.kind === "table" : Boolean(analysis.cell);
  // A collapsed caret in a cell is "empty" for analyseSelection, so
  // derive the cell context from the hit position instead.
  const tableAnalysis =
    isTable && !analysis.cell && target
      ? analyseTableAtPos(editor.state, target.hitPos)
      : analysis;
  // Element commands lead the menu; copy/paste/etc. follow a divider.
  const elementRows =
    target?.kind === "image"
      ? buildImageCommands(editor, target.node, target)
      : target?.kind === "codeBlock"
        ? buildCodeBlockCommands(editor, target.node, target)
        : isTable
          ? buildTableMenuRows(editor, tableAnalysis)
          : [];
  const leadingComponents = elementRows;

  return {
    position,
    buttons,
    overrides,
    submenus,
    leadingComponents: leadingComponents.length > 0 ? leadingComponents : undefined,
    // Keep the section-reference action as the final entry in the menu.
    extraComponents: sectionRows,
  };
}

/**
 * Root row that copies `{{@note-id#section}}` for the section the user
 * is in. A collapsed caret uses its own position; a selection uses its
 * start, so a right-click inside a multi-section selection copies the
 * section the selection begins in. Element right-clicks use the hit
 * position instead of a stale editor selection.
 */
export function buildSectionReferenceRows(
  editor: Editor,
  target?: EditorContextTarget | null,
): RightClickMenuRow[] {
  const noteId = useActiveNoteStore.getState().noteId?.trim() ?? "";
  const state = editor.state;
  const doc = state?.doc;
  const selection = state?.selection;
  const pos =
    selection && selection.from !== selection.to
      ? selection.from
      : (target?.hitPos ?? selection?.from ?? 0);
  const token =
    noteId && doc ? buildSectionReferenceToken(noteId, doc, pos) : "";

  return [
    {
      key: "copy-section-reference",
      label: "Copy section reference",
      icon: <ContentCopyIcon fontSize="small" />,
      // Show the exact token the clipboard will receive before the
      // user commits to copying it.
      tooltip: token ? <code>{token}</code> : undefined,
      disabled: !token,
      handler: () => {
        if (!token) return false;
        void copyToClipboard(token);
        return true;
      },
    },
  ];
}

/**
 * Hover submenu for the Insert button: table, image, latex, code block.
 * Two of the four route through the existing editorMenuStore counters.
 */
export function buildInsertSubmenu(editor: Editor): RightClickSubmenu {
  return {
    items: [
      {
        id: "insert-table",
        label: "Table",
        icon: <TableChartIcon fontSize="small" />,
        handler: () =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
      },
      {
        id: "insert-image",
        label: "Image",
        icon: <AddPhotoAlternateIcon fontSize="small" />,
        handler: () => {
          useEditorMenuStore.getState().openFileDialog();
          return true;
        },
      },
      {
        id: "insert-latex",
        label: "LaTeX",
        icon: <FunctionsIcon fontSize="small" />,
        handler: () => {
          useEditorMenuStore.getState().openLatexDialog();
          return true;
        },
      },
      {
        id: "insert-code",
        label: "Code block",
        icon: <CodeIcon fontSize="small" />,
        handler: () => editor.chain().focus().setCodeBlock().run(),
      },
    ],
  };
}

// Delete commands render red; everything else uses the default colour.
function isDeleteCommand(command: TableCommand): boolean {
  return command.id.startsWith("delete");
}

// One command as a runnable submenu item.
function commandItem(
  command: TableCommand,
  editor: Editor,
  analysis: SelectionAnalysisFull,
): RightClickSubmenuItem {
  return {
    id: command.id,
    label: command.label(analysis),
    icon: iconForName(command.bubbleIcon),
    danger: isDeleteCommand(command),
    handler: () => {
      command.run(editor, analysis);
      return true;
    },
  };
}

// One command as a root-level row.
function commandRow(
  command: TableCommand,
  editor: Editor,
  analysis: SelectionAnalysisFull,
): RightClickMenuRow {
  return {
    key: command.id,
    label: command.label(analysis),
    icon: iconForName(command.bubbleIcon),
    danger: isDeleteCommand(command),
    handler: () => {
      command.run(editor, analysis);
      return true;
    },
  };
}

/**
 * Root rows for a table right-click: Delete table, then nested Rows and
 * Columns submenus, then Clear cell(s). Built from the shared command
 * catalogue, so a new table operation appears here automatically.
 */
export function buildTableMenuRows(
  editor: Editor,
  analysis: SelectionAnalysisFull = analyseSelection(editor.state),
): RightClickMenuRow[] {
  const commands = tableCommandsFor(analysis);
  const byId = new Map(commands.map((command) => [command.id, command]));
  const pick = (ids: readonly TableCommandId[]): TableCommand[] =>
    ids
      .map((id) => byId.get(id))
      .filter((command): command is TableCommand => Boolean(command));

  const rows: RightClickMenuRow[] = [];
  const deleteTable = byId.get("delete-table");
  if (deleteTable) rows.push(commandRow(deleteTable, editor, analysis));

  const rowCommands = pick(ROW_COMMAND_IDS);
  if (rowCommands.length > 0) {
    rows.push({
      key: "table-rows",
      label: "Rows",
      icon: <TableRowsIcon fontSize="small" />,
      submenu: {
        items: rowCommands.map((command) =>
          commandItem(command, editor, analysis),
        ),
      },
    });
  }

  const columnCommands = pick(COLUMN_COMMAND_IDS);
  if (columnCommands.length > 0) {
    rows.push({
      key: "table-columns",
      label: "Columns",
      icon: <ViewColumnIcon fontSize="small" />,
      submenu: {
        items: columnCommands.map((command) =>
          commandItem(command, editor, analysis),
        ),
      },
    });
  }

  const clearCells = byId.get("clear-cells");
  if (clearCells) rows.push(commandRow(clearCells, editor, analysis));

  return rows;
}

/** Commands shown when an image is right-clicked. */
export function buildImageCommands(
  editor: Editor,
  node: ProseMirrorNode,
  target: EditorContextTarget,
): RightClickMenuRow[] {
  const src =
    typeof node.attrs.src === "string" && node.attrs.src ? node.attrs.src : "";
  const rows: RightClickMenuRow[] = [];
  if (src) {
    rows.push({
      key: "image-copy-link",
      label: "Copy image link",
      icon: <ContentCopyIcon fontSize="small" />,
      handler: () => {
        void copyToClipboard(src);
        return true;
      },
    });
  }
  rows.push({
    key: "image-delete",
    label: "Delete image",
    icon: <DeleteIcon fontSize="small" />,
    danger: true,
    handler: () => {
      editor
        .chain()
        .focus()
        .deleteRange({ from: target.from, to: target.to })
        .run();
      return true;
    },
  });
  return rows;
}

/** Commands shown when a code block is right-clicked. */
export function buildCodeBlockCommands(
  editor: Editor,
  node: ProseMirrorNode,
  target: EditorContextTarget,
): RightClickMenuRow[] {
  const code = node.textContent;
  const handler = (): boolean => {
    if (code) void copyToClipboard(code);
    return code.length > 0;
  };
  return [
    {
      key: "code-copy",
      label: "Copy code",
      icon: <ContentCopyIcon fontSize="small" />,
      handler,
    },
    {
      key: "code-delete",
      label: "Delete code block",
      icon: <DeleteIcon fontSize="small" />,
      danger: true,
      handler: () => {
        editor
          .chain()
          .focus()
          .deleteRange({ from: target.from, to: target.to })
          .run();
        return true;
      },
    },
  ];
}
