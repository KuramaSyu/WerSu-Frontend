import React, { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HoldKeyActionBar } from "./HoldKeyActionBar";
import { usePageHoldShortcuts } from "../hooks/usePageHoldShortcuts";
import { useSearchNotesStore } from "../zustand/useSearchNotesStore";

/** Routes where app-wide shortcuts must stay inactive. */
const EXCLUDED_PREFIXES = ["/login", "/public", "/docs"];

/**
 * App-wide hold-to-run shortcuts that are available on every
 * authenticated page:
 *
 *   - `k` opens the search overlay
 *   - `h` goes home
 *
 * Mounted once by the shell. Page-specific actions (new note,
 * new directory, back, …) keep their own `HoldKeyActionBar`.
 */
export const GlobalHoldShortcuts: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const setIsSearchOpen = useSearchNotesStore((s) => s.setIsDialogOpen);

  const goHome = useCallback(() => navigate("/"), [navigate]);

  const actions = usePageHoldShortcuts("global", {
    "global.search": () => setIsSearchOpen(true),
    "global.home": goHome,
  });

  const enabled =
    actions.length > 0 &&
    !EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  return (
    <HoldKeyActionBar
      active={enabled}
      capture={false}
      actions={actions}
    />
  );
};

export default GlobalHoldShortcuts;
