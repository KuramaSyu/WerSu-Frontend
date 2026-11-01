import React, { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HoldKeyActionBar } from "./HoldKeyActionBar";
import { ShortcutsModal } from "../pages/Shortcuts/ShortcutsModal";
import { usePageHoldShortcuts } from "../hooks/usePageHoldShortcuts";
import { useComboShortcuts } from "../hooks/useComboShortcuts";
import { useNavigateBack } from "../hooks/useNavigateBack";
import { useSearchNotesStore } from "../zustand/useSearchNotesStore";
import { useEditorSettings } from "../zustand/useEditorSettings";
import { useViewConfig } from "../zustand/useViewConfig";
import { getShortcutPageIdForPath, hasLocalEscapeOverride } from "../config/shortcuts";

/** Routes where app-wide shortcuts must stay inactive. */
const EXCLUDED_PREFIXES = ["/login", "/public", "/docs"];

/**
 * App-wide shortcuts available on every authenticated page:
 *
 *   - hold `k` opens the search overlay
 *   - `Ctrl + K` opens the search overlay (the rail's search button
 *     and `SearchBar` handle it too; firing it here keeps the
 *     catalogue the single source of truth)
 *   - hold `h` goes home
 *   - hold `Esc` navigates back
 *   - `Ctrl + /` opens the keyboard-shortcut modal
 *
 * Mounted once by the shell. Page-specific actions (new note,
 * new directory, …) keep their own `HoldKeyActionBar`.
 *
 * `Esc` has local overrides: on the note page it leaves source mode or
 * insert mode instead of navigating back, so the global action is
 * suppressed while one of those local actions is active.
 */
export const GlobalShortcuts: React.FC = () => {
  const navigate = useNavigate();
  const navigateBack = useNavigateBack();
  const { pathname } = useLocation();
  const setIsSearchOpen = useSearchNotesStore((s) => s.setIsDialogOpen);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const viewMode = useEditorSettings((s) => s.viewMode);
  const editMode = useEditorSettings((s) => s.editMode);
  const readOnly = useViewConfig((s) => s.config.readOnly);

  const goHome = useCallback(() => navigate("/"), [navigate]);

  const holdActions = usePageHoldShortcuts("global", {
    "global.search": () => setIsSearchOpen(true),
    "global.home": goHome,
    "global.back": navigateBack,
  });

  // True while the active page owns Escape itself (e.g. leaving source
  // or insert mode on the note editor); the global back is suppressed.
  const activePageId = getShortcutPageIdForPath(pathname);
  const localEscapeOverride = hasLocalEscapeOverride(activePageId, {
    viewMode,
    editMode,
    readOnly,
  });

  const activeHoldActions = localEscapeOverride
    ? holdActions.filter((action) => action.id !== "global.back")
    : holdActions;

  const enabled = !EXCLUDED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  useComboShortcuts(
    "global",
    {
      "global.shortcutsModal": () => setShortcutsOpen(true),
      "global.searchCombo": () => setIsSearchOpen(true),
    },
    enabled,
  );

  return (
    <>
      <HoldKeyActionBar
        active={enabled && activeHoldActions.length > 0}
        capture={false}
        actions={activeHoldActions}
      />
      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        hiddenShortcutIds={
          localEscapeOverride ? ["global.back"] : undefined
        }
      />
    </>
  );
};

export default GlobalShortcuts;
