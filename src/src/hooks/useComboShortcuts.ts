import { useEffect, useRef } from "react";
import { getShortcutPage, isComboShortcut } from "../config/shortcuts";
import { isCtrlCombo } from "../utils/CtrlPlus";

/**
 * Attaches a window-level key-down listener for a page's Ctrl/Meta
 * combo shortcuts (the tap, non-hold entries in `config/shortcuts.json`).
 *
 * Combos fire on key-down and call `preventDefault`, so they also work
 * while a text field has focus. Handlers are read through a ref, so
 * the listener never needs to rebind when the caller re-renders.
 */
export function useComboShortcuts(
  pageId: string,
  handlers: Record<string, (() => void) | undefined>,
  enabled = true,
): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const combos = (getShortcutPage(pageId)?.shortcuts ?? []).filter(
      isComboShortcut,
    );
    if (combos.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of combos) {
        if (!shortcut.combo) continue;
        if (isCtrlCombo(event, shortcut.combo)) {
          event.preventDefault();
          handlersRef.current[shortcut.id]?.();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pageId, enabled]);
}
