// Lightweight right-click surface for a single display name.
//
// Used by rows that are not full note/directory cards (history rows in
// the left rail, chapter summaries in the directory view). The menu is
// just Copy, but the handler is supplied per row so the clipboard gets
// the human-readable name instead of the page's current text selection.

import { useCallback, type MouseEvent, type ReactNode } from "react";
import { Box } from "@mui/material";
import { copyToClipboard } from "../../zustand/InfoStore";
import { useRightClickMenu } from "./useRightClickMenu";

export interface CopyNameMenuProps {
  /** Human-readable name copied by the menu's Copy action. */
  text: string;
  /** Optional logical target id (note id, directory id, ...). */
  targetId?: string;
  children: ReactNode;
}

export const CopyNameMenu: React.FC<CopyNameMenuProps> = ({
  text,
  targetId,
  children,
}) => {
  const menu = useRightClickMenu();

  const onContextMenu = useCallback(
    (event: MouseEvent) => {
      menu.onContextMenu(event, {
        targetId,
        buttons: ["copy"],
        overrides: {
          copy: {
            handler: () => {
              void copyToClipboard(text);
              return true;
            },
          },
        },
      });
    },
    [menu, text, targetId],
  );

  return (
    <Box sx={{ display: "contents" }} onContextMenu={onContextMenu}>
      {children}
    </Box>
  );
};

export default CopyNameMenu;
