// The built-in button catalogue.
//
// copy / paste / cut get their real handlers in Phase 3 (T11-T14), so
// they ship with icons and shortcuts but no handler yet: the
// resolver renders them greyed out rather than hiding them.
// edit / delete / favourite stay handlerless forever by design --
// each page supplies its own via overrides.

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import AddIcon from "@mui/icons-material/Add";
import TableChartIcon from "@mui/icons-material/TableChart";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import type { Editor } from "@tiptap/core";
import { useActiveNoteStore } from "../../zustand/editorStore";
import type { RightClickButtonRegistry, RightClickHandler } from "./types";

/** Lazily resolves the live editor, so cards work with no editor mounted. */
function currentEditor(): Editor | null {
  return useActiveNoteStore.getState().editor;
}

const hasEditor: RightClickHandler = () => currentEditor() !== null;

export const rightClickMenuButtons: RightClickButtonRegistry = {
  copy: {
    id: "copy",
    label: "Copy",
    icon: <ContentCopyIcon fontSize="small" />,
    shortcut: "ctrl+c",
  },
  paste: {
    id: "paste",
    label: "Paste",
    icon: <ContentPasteIcon fontSize="small" />,
    shortcut: "ctrl+v",
    canRun: hasEditor,
  },
  cut: {
    id: "cut",
    label: "Cut",
    icon: <ContentCutIcon fontSize="small" />,
    shortcut: "ctrl+x",
    canRun: hasEditor,
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
  },
  favourite: {
    id: "favourite",
    label: "Favourite",
    icon: <StarIcon fontSize="small" />,
  },
};
