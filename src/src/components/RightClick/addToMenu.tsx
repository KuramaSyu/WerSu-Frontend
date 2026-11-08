// Label and icon for the "Add to <book|chapter>" picker action.
//
// The same directory picker is offered from every note surface, but the
// destination vocabulary depends on the level the note lives on: a note
// on Home belongs to a book, a note inside a chapter view belongs to a
// chapter. Keeping both here means the context-menu row and the dialog
// header can never disagree.

import type { ReactNode } from "react";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import {
  addToLabel,
  type DirectoryKind,
} from "../../models/directoryTerminology";

/** "Add to book" / "Add to chapter". */
export const addToMenuLabel = (kind: DirectoryKind): string =>
  addToLabel(kind);

/** Book icon for books, folder icon for chapters. */
export const addToMenuIcon = (kind: DirectoryKind): ReactNode =>
  kind === "chapter" ? (
    <CreateNewFolderIcon fontSize="small" />
  ) : (
    <AutoStoriesIcon fontSize="small" />
  );
