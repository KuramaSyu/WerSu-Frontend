import { useCallback } from "react";
import type { NoteWidthMode } from "../../../api/models/ViewConfig";
import { useLayout } from "../../../LayoutProvider";
import { useViewConfig } from "../../../zustand/useViewConfig";
import { NOTE_WIDTH_STATES, nextNoteWidthMode } from "./noteWidthMode";

export interface UseNoteWidthModeResult {
  widthMode: NoteWidthMode;
  /**
   * Switch directly to a preset, applying/restoring panels as needed.
   * Used by the width shortcuts (F/W/N). A transition to the current
   * mode is a no-op.
   */
  setWidthMode: (mode: NoteWidthMode) => void;
  /** Advance to the next preset, applying/restoring panels as needed. */
  cycleWidthMode: () => void;
}

/**
 * Controller between the width state table and the layout's panels.
 *
 * The state table owns *what* each mode looks like (`NoteWidthState`).
 * This hook owns the *transition* between modes, including the one bit
 * of history the table can't hold: the panel layout to restore when
 * leaving `full`.
 *
 * Why the snapshot lives in `useViewConfig` rather than a per-hook
 * ref or on each state object:
 *   - `NOTE_WIDTH_STATES` is a shared singleton, so a `prevPanelStates`
 *     field would be global mutable state bleeding between note pages.
 *   - a per-hook ref gives each *caller* its own history, so the
 *     top-bar toggle and the editor width shortcuts could not restore
 *     each other's `full` transitions.
 * History belongs to the transition, and there is only ever one
 * in-flight transition per note page, so a single shared slot in the
 * view-config store is the right home.
 */
export function useNoteWidthMode(): UseNoteWidthModeResult {
  const widthMode = useViewConfig((s) => s.config.widthMode);
  const {
    leftPanelOpen,
    rightPanelOpen,
    leftPanelUserOverride,
    rightPanelUserOverride,
    setLeftPanelOpen,
    setRightPanelOpen,
    setLeftPanelUserOverride,
    setRightPanelUserOverride,
  } = useLayout();

  const setWidthMode = useCallback(
    (next: NoteWidthMode) => {
      // Read the live mode from the store so this callback never acts
      // on a stale closure (it can be re-created by several callers).
      const store = useViewConfig.getState();
      const current = store.config.widthMode;
      if (next === current) return;

      // Exit the current state. If it had forced a panel layout, put
      // the user's panels back exactly as they were (open flags *and*
      // overrides, so `usePanelSize`'s breakpoint auto-open resumes).
      if (NOTE_WIDTH_STATES[current]?.panels) {
        const snapshot = store.panelSnapshot;
        store.setPanelSnapshot(null);
        if (snapshot) {
          setLeftPanelOpen(snapshot.leftOpen);
          setRightPanelOpen(snapshot.rightOpen);
          setLeftPanelUserOverride(snapshot.leftOverride);
          setRightPanelUserOverride(snapshot.rightOverride);
        }
      }

      // Enter the next state. If it forces a panel layout, remember
      // the current layout before applying the target. The
      // user-override flags are pinned so `usePanelSize` can't
      // immediately re-open the panels we just collapsed.
      const target = NOTE_WIDTH_STATES[next]?.panels;
      if (target) {
        store.setPanelSnapshot({
          leftOpen: leftPanelOpen,
          rightOpen: rightPanelOpen,
          leftOverride: leftPanelUserOverride,
          rightOverride: rightPanelUserOverride,
        });
        setLeftPanelUserOverride(true);
        setRightPanelUserOverride(true);
        setLeftPanelOpen(target.leftOpen);
        setRightPanelOpen(target.rightOpen);
      }

      store.setViewConfig({ widthMode: next });
    },
    [
      leftPanelOpen,
      rightPanelOpen,
      leftPanelUserOverride,
      rightPanelUserOverride,
      setLeftPanelOpen,
      setRightPanelOpen,
      setLeftPanelUserOverride,
      setRightPanelUserOverride,
    ],
  );

  const cycleWidthMode = useCallback(() => {
    setWidthMode(nextNoteWidthMode(useViewConfig.getState().config.widthMode));
  }, [setWidthMode]);

  return { widthMode, setWidthMode, cycleWidthMode };
}
