// Writes editorMenuStore.isTextSelectionMenuOpen from selectionUpdate /
// focus / blur / awareness change. See tiptap-perf-flushSync memory.

import { memo, useEffect } from "react";
import type { Editor } from "@tiptap/core";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { useEditorMenuStore } from "../../zustand/editorMenuStore";
import { logRerender } from "../../pages/NotePage/editorRenderLog";

export interface MenuVisibilityBridgeProps {
  editor: Editor | null;
  provider: HocuspocusProvider | null;
  enabled?: boolean;
}

// O(1) check. Whitespace-only selection is filtered by the BubbleMenu plugin itself.
function computeVisibility(editor: Editor, enabled: boolean): boolean {
  if (!enabled || !editor.isEditable) return false;
  if (!editor.isFocused) return false;
  const { from, to, empty } = editor.state.selection;
  if (empty || from === to) return false;
  return true;
}

const MenuVisibilityBridgeImpl: React.FC<MenuVisibilityBridgeProps> = ({
  editor,
  provider,
  enabled = true,
}) => {
  logRerender("MenuVisibilityBridge", { hasEditor: !!editor, enabled });
  const setTextSelectionMenuOpen = useEditorMenuStore(
    (state) => state.setTextSelectionMenuOpen,
  );

  useEffect(() => {
    if (!editor) {
      setTextSelectionMenuOpen(false);
      return;
    }
    const sync = () =>
      setTextSelectionMenuOpen(computeVisibility(editor, enabled));
    editor.on("selectionUpdate", sync);
    editor.on("focus", sync);
    editor.on("blur", sync);
    sync();
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("focus", sync);
      editor.off("blur", sync);
      setTextSelectionMenuOpen(false);
    };
  }, [editor, enabled, setTextSelectionMenuOpen]);

  // For awareness changes that don't trigger selectionUpdate (remote-only moves).
  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness || !editor) return;
    const sync = () =>
      setTextSelectionMenuOpen(computeVisibility(editor, enabled));
    awareness.on("change", sync);
    return () => awareness.off("change", sync);
  }, [provider, editor, enabled, setTextSelectionMenuOpen]);

  return null;
};

export const MenuVisibilityBridge = memo(MenuVisibilityBridgeImpl);
