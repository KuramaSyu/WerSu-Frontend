// Installs the editor's context-menu opener.
//
// The listener is attached to editor.view.dom in the capture phase, so
// right-clicks on node views (images, code blocks) are handled before
// the browser can show its native menu. The opener is also mirrored
// into a stable ref, which the editor's handleDOMEvents fallback uses;
// stopImmediatePropagation keeps the two paths from double-opening.

import { useEffect } from "react";
import type { Editor } from "@tiptap/core";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useRightClickMenuStore } from "../../zustand/useRightClickMenuStore";
import {
  applyEditorContextTarget,
  resolveEditorContextTarget,
} from "../Editor/editorContextTarget";
import {
  clearEditorContextHighlight,
  setEditorContextHighlight,
} from "../Editor/editorContextHighlight";
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

    let detach: (() => void) | null = null;

    const attach = () => {
      if (editor.isDestroyed) return;
      // Re-attach on every create: a rich/source toggle can replace the
      // editor DOM, so the previous listener must be moved off it.
      detach?.();
      const dom = editor.view.dom;

      const handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        // Capture listener: also stop the bubble-phase handleDOMEvents
        // handler, so the menu is only opened once.
        event.stopImmediatePropagation();

        const coords = { x: event.clientX, y: event.clientY };
        const target = resolveEditorContextTarget(
          editor,
          coords,
          event.target,
        );
        if (target) {
          applyEditorContextTarget(editor, target);
          setEditorContextHighlight(editor, target.from);
        } else {
          clearEditorContextHighlight(editor);
        }

        useRightClickMenuStore.getState().openMenu(
          buildEditorMenuRequest(editor, editMode, coords, target),
        );
      };

      // Attach directly to the editor DOM in the capture phase. This is
      // the reliable path for right-clicks on node views (images, code
      // blocks) where the event can otherwise reach Firefox's native
      // menu before ProseMirror's bubble-phase handler sees it.
      openerRef.current = handleContextMenu;
      dom.addEventListener("contextmenu", handleContextMenu, true);

      detach = () => {
        dom.removeEventListener("contextmenu", handleContextMenu, true);
        openerRef.current = null;
        if (!editor.isDestroyed) clearEditorContextHighlight(editor);
      };
    };

    // The editor object exists before its view is mounted. Attaching to
    // editor.view.dom then throws; the create event (also fired on every
    // remount) retries. When the view is already available, attach()
    // succeeds immediately.
    editor.on("create", attach);
    try {
      attach();
    } catch {
      // View not mounted yet; the create handler will attach it.
    }

    return () => {
      editor.off("create", attach);
      detach?.();
    };
  }, [editor, editMode, isMobile, openerRef]);

  // Clear the highlight as soon as the menu closes for any reason.
  useEffect(() => {
    if (!editor) return;
    const unsubscribe = useRightClickMenuStore.subscribe((state, prev) => {
      if (prev.isOpen && !state.isOpen && !editor.isDestroyed) {
        clearEditorContextHighlight(editor);
      }
    });
    return unsubscribe;
  }, [editor]);

  return null;
};

export default EditorRightClickMenu;
