// Writes editorMenuStore.isTextSelectionMenuOpen from selectionUpdate /
// focus / blur / awareness change, plus the table-selection
// summary the bubble menu strategies read. Also tracks the
// pointer state: while a drag is in progress, the bubble menu
// stays hidden so it does not flicker alongside the live
// selection rect. See tiptap-perf-flushSync memory.

import { memo, useEffect } from "react";
import type { Editor } from "@tiptap/core";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { useEditorMenuStore } from "../../zustand/editorMenuStore";
import { useEditorTableSelectionStore } from "../../zustand/editorTableSelectionStore";
import { analyseSelection } from "./bubbleMenuStrategies";
import { logRerender } from "../../pages/NotePage/editorRenderLog";

export interface MenuVisibilityBridgeProps {
  editor: Editor | null;
  provider: HocuspocusProvider | null;
  enabled?: boolean;
}

// O(1) check. Whitespace-only selection is filtered by the BubbleMenu plugin itself.
// `isPointerDown` short-circuits to false so the menu only appears
// after the user has released the mouse.
function computeVisibility(
  editor: Editor,
  enabled: boolean,
  isPointerDown: boolean,
): boolean {
  if (!enabled || !editor.isEditable) return false;
  if (!editor.isFocused) return false;
  if (isPointerDown) return false;
  const { from, to, empty } = editor.state.selection;
  if (empty || from === to) return false;
  return true;
}

// Push the table-selection summary into its store. Called on
// every selectionUpdate; the store's default state means we can
// skip pushes when nothing changed.
function pushTableSelection(editor: Editor): void {
  const analysis = analyseSelection(editor.state);
  const store = useEditorTableSelectionStore.getState();
  if (analysis.kind === "tableRow" && analysis.cell) {
    store.setSelection({
      isFullRow: true,
      isFullColumn: false,
      isMultiTable: false,
      rowIndices: analysis.cell.rowIndices,
      columnIndices: analysis.cell.columnIndices,
    });
    return;
  }
  if (analysis.kind === "tableColumn" && analysis.cell) {
    store.setSelection({
      isFullRow: false,
      isFullColumn: true,
      isMultiTable: false,
      rowIndices: analysis.cell.rowIndices,
      columnIndices: analysis.cell.columnIndices,
    });
    return;
  }
  if (analysis.kind === "tableBlock" || analysis.kind === "tableCell") {
    store.setSelection({
      isFullRow: false,
      isFullColumn: false,
      isMultiTable: false,
      rowIndices: analysis.cell?.rowIndices ?? [],
      columnIndices: analysis.cell?.columnIndices ?? [],
    });
    return;
  }
  // Empty / text / multi-table: reset so the bubble menu's
  // table strategies do not see stale data.
  store.reset();
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
  const setPointerDown = useEditorMenuStore((state) => state.setPointerDown);

  useEffect(() => {
    if (!editor) {
      setTextSelectionMenuOpen(false);
      useEditorTableSelectionStore.getState().reset();
      return;
    }
    const sync = () => {
      const { isPointerDown } = useEditorMenuStore.getState();
      setTextSelectionMenuOpen(
        computeVisibility(editor, enabled, isPointerDown),
      );
      pushTableSelection(editor);
    };
    editor.on("selectionUpdate", sync);
    editor.on("focus", sync);
    editor.on("blur", sync);
    sync();
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("focus", sync);
      editor.off("blur", sync);
      setTextSelectionMenuOpen(false);
      useEditorTableSelectionStore.getState().reset();
    };
  }, [editor, enabled, setTextSelectionMenuOpen]);

  // For awareness changes that don't trigger selectionUpdate (remote-only moves).
  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness || !editor) return;
    const sync = () => {
      const { isPointerDown } = useEditorMenuStore.getState();
      setTextSelectionMenuOpen(
        computeVisibility(editor, enabled, isPointerDown),
      );
      pushTableSelection(editor);
    };
    awareness.on("change", sync);
    return () => awareness.off("change", sync);
  }, [provider, editor, enabled, setTextSelectionMenuOpen]);

  // Pointer-state tracking. Listens on the editor's DOM for
  // pointerdown (so a click that started outside the editor
  // doesn't toggle us) and on `window` for pointerup (so a
  // release that ends outside the editor still clears the
  // flag).
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view?.dom as HTMLElement | undefined;
    if (!dom) return;

    const onPointerDown = (event: PointerEvent) => {
      // The event is already routed through ProseMirror's own
      // selection logic; we only care about the side effect of
      // hiding the bubble menu until release.
      if (event.button !== 0) return;
      setPointerDown(true);
    };
    const onPointerUp = () => {
      const wasDown = useEditorMenuStore.getState().isPointerDown;
      if (!wasDown) return;
      setPointerDown(false);
      // Re-run the visibility check immediately so the menu
      // pops in on release without waiting for a stray
      // selectionUpdate.
      setTextSelectionMenuOpen(computeVisibility(editor, enabled, false));
    };
    const onPointerCancel = () => setPointerDown(false);
    const onBlur = () => setPointerDown(false);

    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("blur", onBlur);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("blur", onBlur);
    };
  }, [editor, enabled, setPointerDown, setTextSelectionMenuOpen]);

  return null;
};

export const MenuVisibilityBridge = memo(MenuVisibilityBridgeImpl);
