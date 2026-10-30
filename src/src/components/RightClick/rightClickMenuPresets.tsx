// Pure(ish) request builders for the editor surface.
//
// These read the editor state at right-click time, so the menu only
// ever shows operations that apply to the selection that was hit.
// No React and no re-renders: the caller invokes these from the
// contextmenu DOM handler.

import type { Editor } from "@tiptap/core";
import TableChartIcon from "@mui/icons-material/TableChart";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import FunctionsIcon from "@mui/icons-material/Functions";
import CodeIcon from "@mui/icons-material/Code";
import FormatClearIcon from "@mui/icons-material/FormatClear";
import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconTableOff,
} from "@tabler/icons-react";
import {
  analyseSelection,
  clearCells,
  type SelectionAnalysisFull,
} from "../Editor/bubbleMenuStrategies";
import { useEditorMenuStore } from "../../zustand/editorMenuStore";
import type {
  MenuPosition,
  RightClickButtonId,
  RightClickButtonOverride,
  RightClickMenuRequest,
  RightClickSubmenu,
  RightClickSubmenuItem,
} from "./types";

/** Canonical editor rows, in catalogue order. Insert/table are submenu triggers. */
const EDITOR_BUTTONS: readonly RightClickButtonId[] = [
  "copy",
  "paste",
  "cut",
  "insert",
];

/**
 * Build the full request for a right-click inside the editor.
 * Read mode (decision 3) is copy only: paste renders but is greyed
 * out by its canRun probe, and no table or insert row is requested.
 */
export function buildEditorMenuRequest(
  editor: Editor,
  editMode: boolean,
  position: MenuPosition,
): RightClickMenuRequest {
  if (!editMode) {
    return { position, buttons: ["copy", "paste"] };
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

  const table = buildTableSubmenu(editor, analysis);
  if (table) {
    buttons.push("table");
    overrides.table = { handler: () => true };
    submenus.table = table;
  }

  return { position, buttons, overrides, submenus };
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

/**
 * Hover submenu for the Table button. Returns null when the click did
 * not land in a table, so the caller can leave the button out.
 */
export function buildTableSubmenu(
  editor: Editor,
  analysis: SelectionAnalysisFull = analyseSelection(editor.state),
): RightClickSubmenu | null {
  const cell = analysis.cell;
  if (!cell) return null;

  const rowCount = cell.rowIndices.length;
  const columnCount = cell.columnIndices.length;
  const items: RightClickSubmenuItem[] = [
    {
      id: "add-row-before",
      label: "Insert row above",
      icon: <IconRowInsertTop size={18} />,
      handler: () => editor.chain().focus().addRowBefore().run(),
    },
    {
      id: "add-row-after",
      label: "Insert row below",
      icon: <IconRowInsertBottom size={18} />,
      handler: () => editor.chain().focus().addRowAfter().run(),
    },
    {
      id: "add-column-before",
      label: "Insert column left",
      icon: <IconColumnInsertLeft size={18} />,
      handler: () => editor.chain().focus().addColumnBefore().run(),
    },
    {
      id: "add-column-after",
      label: "Insert column right",
      icon: <IconColumnInsertRight size={18} />,
      handler: () => editor.chain().focus().addColumnAfter().run(),
    },
    {
      id: "delete-row",
      label: rowCount > 1 ? "Delete rows" : "Delete row",
      icon: <IconRowRemove size={18} />,
      handler: () => editor.chain().focus().deleteRow().run(),
    },
    {
      id: "delete-column",
      label: columnCount > 1 ? "Delete columns" : "Delete column",
      icon: <IconColumnRemove size={18} />,
      handler: () => editor.chain().focus().deleteColumn().run(),
    },
    {
      id: "clear-cells",
      label: rowCount > 1 || columnCount > 1 ? "Clear cells" : "Clear cell",
      icon: <FormatClearIcon fontSize="small" />,
      handler: () => {
        clearCells(editor);
        return true;
      },
    },
    {
      id: "delete-table",
      label: "Delete table",
      icon: <IconTableOff size={18} />,
      handler: () => editor.chain().focus().deleteTable().run(),
    },
  ];

  // A whole-table selection cannot take row/column edits or a clear.
  if (analysis.kind === "tableWhole") {
    return { items: items.filter((item) => item.id === "delete-table") };
  }
  return { items };
}
