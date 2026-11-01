import { useCallback, useMemo } from "react";
import { useActiveNoteStore } from "../../../zustand/editorStore";
import { useEditorSettings } from "../../../zustand/useEditorSettings";
import { useViewConfig } from "../../../zustand/useViewConfig";
import type { HoldKeyAction } from "../../../hooks/useKeyHold";
import {
  getShortcutPage,
  isComboShortcut,
  matchesShortcutState,
  type ShortcutState,
} from "../../../config/shortcuts";

/** Page id in `config/shortcuts.json` that this hook resolves. */
const PAGE_ID = "note";

/**
 * A hold-to-run editor shortcut plus whether it applies to the current
 * editor state. The panel renders every entry (dimming the inactive
 * ones) while the floating action bar only listens to the active set.
 */
export interface EditorShortcut extends HoldKeyAction {
  available: boolean;
}

export interface EditorModeShortcuts {
  /** Every shortcut, active or not, for the reference panel. */
  shortcuts: EditorShortcut[];
  /** The currently-applicable subset, fed to `HoldKeyActionBar`. */
  actions: HoldKeyAction[];
}

/**
 * Resolves the `note` page's shortcuts from the shared JSON catalogue
 * and binds each id to its runtime handler.
 *
 * "Insert mode" is the editor's write mode (`editMode`). The Escape
 * shortcut is contextual: while the source view is open it leaves the
 * source editor; otherwise, while in insert mode, it leaves insert
 * mode. The "I" shortcut enters insert mode from read mode, and "S"
 * opens the source editor from either mode.
 */
export function useEditorModeShortcuts(): EditorModeShortcuts {
  const viewMode = useEditorSettings((s) => s.viewMode);
  const editMode = useEditorSettings((s) => s.editMode);
  const setViewMode = useEditorSettings((s) => s.setViewMode);
  const setWrite = useEditorSettings((s) => s.setWrite);
  const setSourceMarkdown = useActiveNoteStore((s) => s.setSourceMarkdown);
  const getContent = useActiveNoteStore((s) => s.getContent);
  const setContent = useActiveNoteStore((s) => s.setContent);
  const readOnly = useViewConfig((s) => s.config.readOnly);

  const leaveSource = useCallback(() => {
    // Read the markdown on demand rather than subscribing: this hook is
    // also used by the rail panel, which must not re-render per keystroke.
    const sourceMarkdown = useActiveNoteStore.getState().sourceMarkdown;
    setContent(sourceMarkdown);
    setViewMode("rich");
  }, [setContent, setViewMode]);

  const openSource = useCallback(() => {
    // `getContent` serialises the rich editor while in rich mode and
    // returns the stored markdown while already in source mode.
    setSourceMarkdown(getContent());
    setViewMode("source");
  }, [getContent, setSourceMarkdown, setViewMode]);

  const enterInsert = useCallback(() => setWrite(true), [setWrite]);
  const leaveInsert = useCallback(() => setWrite(false), [setWrite]);

  // id -> runtime callback. Kept separate from the JSON so the config
  // stays pure data (page, keys, state) that any UI can read.
  const handlers = useMemo<Record<string, () => void>>(
    () => ({
      "note.leaveSource": leaveSource,
      "note.openSource": openSource,
      "note.enterInsert": enterInsert,
      "note.leaveInsert": leaveInsert,
    }),
    [leaveSource, openSource, enterInsert, leaveInsert],
  );

  const shortcuts = useMemo<EditorShortcut[]>(() => {
    const page = getShortcutPage(PAGE_ID);
    if (!page) return [];
    const state: ShortcutState = { viewMode, editMode, readOnly };
    return page.shortcuts
      .filter((shortcut) => !isComboShortcut(shortcut))
      .map((shortcut) => ({
        key: shortcut.key ?? "",
        keyLabel: shortcut.keyLabel,
        label: shortcut.label,
        // A tap action fires as soon as the key goes down.
        duration: shortcut.hold === false ? 0 : undefined,
        allowInTextFields: shortcut.allowInTextFields,
        available: matchesShortcutState(shortcut.when, state),
        onTrigger: handlers[shortcut.id] ?? (() => undefined),
      }));
  }, [viewMode, editMode, readOnly, handlers]);

  const actions = useMemo<HoldKeyAction[]>(
    () =>
      shortcuts
        .filter((shortcut) => shortcut.available)
        .map((shortcut) => ({
          key: shortcut.key,
          keyLabel: shortcut.keyLabel,
          label: shortcut.label,
          duration: shortcut.duration,
          allowInTextFields: shortcut.allowInTextFields,
          onTrigger: shortcut.onTrigger,
        })),
    [shortcuts],
  );

  return { shortcuts, actions };
}
