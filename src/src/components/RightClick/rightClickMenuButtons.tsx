// The built-in button catalogue.
//
// copy / paste / cut ship with sensible editor defaults; providers
// can override them per surface. edit / delete / favourite stay
// handlerless forever by design -- each page supplies its own via
// overrides.

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import AddIcon from "@mui/icons-material/Add";
import TableChartIcon from "@mui/icons-material/TableChart";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import { copyToClipboard } from "../../zustand/InfoStore";
import {
  copyEditorSelection,
  currentEditor,
  cutEditorSelection,
  pasteIntoEditor,
} from "./editorClipboard";
import type { RightClickButtonRegistry, RightClickHandler } from "./types";

// The plain-text selection on the page, used when no editor is mounted.
function windowSelectionText(): string {
  if (typeof window === "undefined") return "";
  return window.getSelection()?.toString() ?? "";
}

const hasEditor: RightClickHandler = () => currentEditor() !== null;

const hasSelection: RightClickHandler = () => {
  const editor = currentEditor();
  if (editor) {
    const { from, to } = editor.state.selection;
    if (from !== to) return true;
  }
  return windowSelectionText() !== "";
};

const hasEditableEditor: RightClickHandler = () => {
  const editor = currentEditor();
  return editor !== null && editor.isEditable;
};

export const rightClickMenuButtons: RightClickButtonRegistry = {
  copy: {
    id: "copy",
    label: "Copy",
    icon: <ContentCopyIcon fontSize="small" />,
    shortcut: "ctrl+c",
    canRun: hasSelection,
    handler: () => {
      // Editor selection first; otherwise copy whatever the page has
      // selected so the global fallback menu is still useful.
      void (async () => {
        const copied = await copyEditorSelection();
        if (copied) return;
        const text = windowSelectionText();
        if (text) await copyToClipboard(text);
      })();
      return true;
    },
  },
  paste: {
    id: "paste",
    label: "Paste",
    icon: <ContentPasteIcon fontSize="small" />,
    shortcut: "ctrl+v",
    canRun: hasEditableEditor,
    handler: () => {
      void pasteIntoEditor();
      return true;
    },
  },
  cut: {
    id: "cut",
    label: "Cut",
    icon: <ContentCutIcon fontSize="small" />,
    shortcut: "ctrl+x",
    canRun: (targetId) => hasEditableEditor(targetId) && hasSelection(targetId),
    handler: () => {
      void cutEditorSelection();
      return true;
    },
  },
  insert: {
    id: "insert",
    label: "Insert",
    icon: <AddIcon fontSize="small" />,
    canRun: hasEditor,
  },
  table: {
    id: "table",
    label: "Table",
    icon: <TableChartIcon fontSize="small" />,
    canRun: hasEditor,
  },
  // Handlerless on purpose: every surface supplies its own.
  edit: {
    id: "edit",
    label: "Edit",
    icon: <EditIcon fontSize="small" />,
  },
  delete: {
    id: "delete",
    label: "Delete",
    icon: <DeleteIcon fontSize="small" />,
    danger: true,
  },
  favourite: {
    id: "favourite",
    label: "Favourite",
    icon: <StarIcon fontSize="small" />,
  },
};
