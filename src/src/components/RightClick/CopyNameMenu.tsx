// Lightweight right-click surface for a single display name.
//
// Used by rows that are not full note/directory cards (history rows in
// the left rail, chapter summaries in the directory view). The base menu
// is just Copy, but the handler is supplied per row so the clipboard gets
// the human-readable name instead of the page's current text selection.
// Note rows also get "Add to directory" via the optional `note` prop.

import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import { Box } from "@mui/material";
import { copyToClipboard } from "../../zustand/InfoStore";
import { useRightClickMenu } from "./useRightClickMenu";
import { AddToDirectoryDialog } from "./AddToDirectoryDialog";

export interface CopyNameMenuProps {
  /** Human-readable name copied by the menu's Copy action. */
  text: string;
  /** Optional logical target id (note id, directory id, ...). */
  targetId?: string;
  /**
   * When provided, the menu also offers "Add to directory". Pass this
   * only for note rows; directory summaries keep the copy-only menu.
   */
  note?: { id: string; title: string };
  children: ReactNode;
}

export const CopyNameMenu: React.FC<CopyNameMenuProps> = ({
  text,
  targetId,
  note,
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
    [menu, text, targetId, note],
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
        />
      )}
    </Box>
  );
};

export default CopyNameMenu;
