import { useEffect, useMemo, useRef } from "react";
import type { HoldKeyAction } from "./useKeyHold";
import {
  getShortcutPage,
  isComboShortcut,
  matchesShortcutState,
  type ShortcutState,
} from "../config/shortcuts";

/** Runtime state a page-level `when` condition can reference. */
const DEFAULT_STATE: ShortcutState = {
  viewMode: "rich",
  editMode: false,
  readOnly: false,
};

/**
 * Resolves a page's hold-to-run shortcuts from the shared JSON
 * catalogue and binds each id to a runtime handler.
 *
 * Unlike `useEditorModeShortcuts`, pages using this hook (home,
 * directory view) have no editor state to gate on, so every entry
 * without a `when` condition is active. Handlers are read through a
 * ref, which keeps the returned action list stable across renders so
 * `HoldKeyActionBar` never restarts an in-flight hold.
 */
export function usePageHoldShortcuts(
  pageId: string,
  handlers: Record<string, (() => void) | undefined>,
): HoldKeyAction[] {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  return useMemo(() => {
    const page = getShortcutPage(pageId);
    if (!page) return [];
    return page.shortcuts
      .filter((shortcut) => !isComboShortcut(shortcut))
      .filter((shortcut) => matchesShortcutState(shortcut.when, DEFAULT_STATE))
      .map<HoldKeyAction>((shortcut) => ({
        key: shortcut.key ?? "",
        keyLabel: shortcut.keyLabel,
        label: shortcut.label,
        // A tap action fires as soon as the key goes down.
        duration: shortcut.hold === false ? 0 : undefined,
        allowInTextFields: shortcut.allowInTextFields,
        onTrigger: () => handlersRef.current[shortcut.id]?.(),
      }));
  }, [pageId]);
}
