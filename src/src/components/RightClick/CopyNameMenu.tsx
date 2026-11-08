// Lightweight right-click surface for a single display name.
//
// Used by rows that are not full note/directory cards (history rows in
// the left rail, chapter summaries in the directory view). The base menu
// is just Copy, but the handler is supplied per row so the clipboard gets
// the human-readable name instead of the page's current text selection.
// Note rows also get "Add to book" (or "Add to chapter" when `targetKind`
// says the row lives inside a chapter) via the optional `note` prop.

import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import { Box } from "@mui/material";
import { copyToClipboard } from "../../zustand/InfoStore";
import type { DirectoryKind } from "../../models/directoryTerminology";
import { useRightClickMenu } from "./useRightClickMenu";
import { AddToDirectoryDialog } from "./AddToDirectoryDialog";
import { addToMenuIcon, addToMenuLabel } from "./addToMenu";

export interface CopyNameMenuProps {
  /** Human-readable name copied by the menu's Copy action. */
  text: string;
  /** Optional logical target id (note id, directory id, ...). */
  targetId?: string;
  /**
   * When provided, the menu also offers "Add to book"/"Add to chapter".
   * Pass this only for note rows; directory summaries keep the
   * copy-only menu.
   */
  note?: { id: string; title: string };
  /**
   * Level the row lives on, used for the picker wording. Defaults to
   * "book"; chapter summaries and chapter note rows pass "chapter".
   */
  targetKind?: DirectoryKind;
  children: ReactNode;
}

export const CopyNameMenu: React.FC<CopyNameMenuProps> = ({
  text,
  targetId,
  note,
  targetKind = "book",
  children,
}) => {
  const menu = useRightClickMenu();
  const [addToDirectoryOpen, setAddToDirectoryOpen] = useState(false);

  const onContextMenu = useCallback(
    (event: MouseEvent) => {
      menu.onContextMenu(event, {
        targetId,
        buttons: note ? ["copy", "addToDirectory"] : ["copy"],
        overrides: {
          copy: {
            handler: () => {
              void copyToClipboard(text);
              return true;
            },
          },
          ...(note
            ? {
                addToDirectory: {
                  label: addToMenuLabel(targetKind),
                  icon: addToMenuIcon(targetKind),
                  handler: () => {
                    setAddToDirectoryOpen(true);
                    return true;
                  },
                },
              }
            : {}),
        },
      });
    },
    [menu, text, targetId, note, targetKind],
  );

  return (
    <Box sx={{ display: "contents" }} onContextMenu={onContextMenu}>
      {children}
      {note && (
        <AddToDirectoryDialog
          open={addToDirectoryOpen}
          onClose={() => setAddToDirectoryOpen(false)}
          noteId={note.id}
          noteTitle={note.title}
          defaultKind={targetKind}
        />
      )}
    </Box>
  );
};

export default CopyNameMenu;
