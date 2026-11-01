import React, { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HoldKeyActionBar } from "./HoldKeyActionBar";
import { ShortcutsModal } from "../pages/Shortcuts/ShortcutsModal";
import { usePageHoldShortcuts } from "../hooks/usePageHoldShortcuts";
import { useComboShortcuts } from "../hooks/useComboShortcuts";
import { useSearchNotesStore } from "../zustand/useSearchNotesStore";

/** Routes where app-wide shortcuts must stay inactive. */
const EXCLUDED_PREFIXES = ["/login", "/public", "/docs"];

/**
 * App-wide shortcuts available on every authenticated page:
 *
 *   - hold `k` opens the search overlay
 *   - hold `h` goes home
 *   - `Ctrl + /` opens the keyboard-shortcut modal
 *
 * Mounted once by the shell. Page-specific actions (new note,
 * new directory, back, …) keep their own `HoldKeyActionBar`.
 */
export const GlobalShortcuts: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const setIsSearchOpen = useSearchNotesStore((s) => s.setIsDialogOpen);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const goHome = useCallback(() => navigate("/"), [navigate]);

  const holdActions = usePageHoldShortcuts("global", {
    "global.search": () => setIsSearchOpen(true),
    "global.home": goHome,
  });

  const enabled = !EXCLUDED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  useComboShortcuts(
    "global",
    {
      "global.shortcutsModal": () => setShortcutsOpen(true),
    },
    enabled,
  );

  return (
    <>
      <HoldKeyActionBar
        active={enabled && holdActions.length > 0}
        capture={false}
        actions={holdActions}
      />
      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </>
  );
};

export default GlobalShortcuts;
