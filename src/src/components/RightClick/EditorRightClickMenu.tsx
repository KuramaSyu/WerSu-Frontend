// Installs the editor's context-menu opener.
//
// The opener lives behind a stable ref (mirroring latexOpenerRef)
// because editorProps.handleDOMEvents is captured once per editor
// build: an inline closure would rebuild the editor config on every
// render and restart the flushSync storm the hook already guards
// against. This component only writes the ref, so it never needs to
// re-render the editor subtree.

import { useEffect } from "react";
import type { Editor } from "@tiptap/core";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";
import { buildEditorMenuRequest } from "./rightClickMenuPresets";

/** Opens the menu for a DOM contextmenu event. Receives no editor: the ref owns it. */
export type EditorContextMenuOpener = (event: MouseEvent) => void;

export interface EditorRightClickMenuProps {
  editor: Editor | null;
  editMode: boolean;
  openerRef: React.MutableRefObject<EditorContextMenuOpener | null>;
}

export const EditorRightClickMenu: React.FC<EditorRightClickMenuProps> = ({
  editor,
  editMode,
  openerRef,
}) => {
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    // Touch devices keep the native behaviour (decision 5). A null
    // opener also makes the DOM handler return false.
    if (!editor || isMobile) {
      openerRef.current = null;
      return;
    }

    openerRef.current = (event) => {
      event.preventDefault();
      // Stop the global fallback from also firing for this event.
      event.stopPropagation();
      useRightClickMenuStore.getState().openMenu(
        buildEditorMenuRequest(editor, editMode, {
          x: event.clientX,
          y: event.clientY,
        }),
      );
    };

    return () => {
      openerRef.current = null;
    };
  }, [editor, editMode, isMobile, openerRef]);

  return null;
};

export default EditorRightClickMenu;
