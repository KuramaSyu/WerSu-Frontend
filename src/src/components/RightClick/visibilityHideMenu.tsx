// Shared "Hide" submenu for note/directory right-click menus.
//
// The three fixed windows hide immediately. "Custom" opens a small date
// dialog owned by the same hook, so each menu only has to hand in its
// target and scope.

import { useCallback, useMemo, useState, type ReactNode } from "react";
import WatchLaterIcon from "@mui/icons-material/WatchLater";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { useNoteVisibilityStore } from "../../zustand/useNoteVisibilityStore";
import type { NoteVisibilityTarget } from "../../api/models/noteVisibility";
import type { RightClickSubmenu } from "./types";
import { VisibilityCustomDialog } from "./VisibilityCustomDialog";
import { isoDateAfterDays } from "./visibilityDate";

/** Fixed durations offered by the submenu, in days. */
const QUICK_DURATIONS = [
  { id: "visibility-hide-1w", label: "1 week", days: 7 },
  { id: "visibility-hide-30d", label: "30 days", days: 30 },
  { id: "visibility-hide-90d", label: "90 days", days: 90 },
] as const;

export interface VisibilityHideMenu {
  /** Build a submenu for the target that was right-clicked. */
  buildSubmenu: (target: NoteVisibilityTarget) => RightClickSubmenu;
  /** Dialog node that must be rendered by the caller. */
  dialog: ReactNode;
}

/**
 * Build the Hide submenu and own its custom-date dialog.
 *
 * Call unconditionally (rules of hooks). Only show the returned submenu
 * when a real scope is passed by the surface.
 */
export function useVisibilityHideMenu(scope: number): VisibilityHideMenu {
  const hideTarget = useNoteVisibilityStore((state) => state.hideTarget);
  const [customTarget, setCustomTarget] =
    useState<NoteVisibilityTarget | null>(null);
  const [customDate, setCustomDate] = useState(() => isoDateAfterDays(7));

  const buildSubmenu = useCallback(
    (target: NoteVisibilityTarget): RightClickSubmenu => ({
      items: [
        ...QUICK_DURATIONS.map((duration) => ({
          id: duration.id,
          label: duration.label,
          icon: <WatchLaterIcon fontSize="small" />,
          handler: () => {
            hideTarget(target, scope, { days: duration.days });
            return true;
          },
        })),
        {
          id: "visibility-hide-custom",
          label: "Custom...",
          icon: <CalendarMonthIcon fontSize="small" />,
          handler: () => {
            setCustomTarget(target);
            setCustomDate(isoDateAfterDays(7));
            return true;
          },
        },
      ],
    }),
    [hideTarget, scope],
  );

  const dialog = useMemo(
    () => (
      <VisibilityCustomDialog
        open={customTarget !== null}
        target={customTarget}
        scope={scope}
        date={customDate}
        onDateChange={setCustomDate}
        onClose={() => setCustomTarget(null)}
      />
    ),
    [customTarget, scope, customDate],
  );

  return { buildSubmenu, dialog };
}