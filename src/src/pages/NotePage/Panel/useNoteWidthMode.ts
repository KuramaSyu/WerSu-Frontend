import { useRef } from "react";
import type { NoteWidthMode } from "../../../api/models/ViewConfig";
import { useLayout } from "../../../LayoutProvider";
import { useViewConfig } from "../../../zustand/useViewConfig";
import { NOTE_WIDTH_STATES, nextNoteWidthMode } from "./noteWidthMode";

/**
 * The user's panel layout captured just before a state that manages
 * panels (`full`) took over. Restored when that state is left, so
 * entering full is lossless.
 */
export interface NotePanelSnapshot {
  leftOpen: boolean;
  rightOpen: boolean;
  leftOverride: boolean;
  rightOverride: boolean;
}

export interface UseNoteWidthModeResult {
  widthMode: NoteWidthMode;
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
 * Why the snapshot lives here rather than on each state object:
 * `NOTE_WIDTH_STATES` is a shared singleton, so a `prevPanelStates`
 * field would be global mutable state — it would bleed between note
 * pages, be wrong under React StrictMode's double-invocation, and
 * couldn't represent "the layout before *this* transition" once two
 * transitions overlap. History belongs to the transition, not to the
 * state.
 */
export function useNoteWidthMode(): UseNoteWidthModeResult {
  const widthMode = useViewConfig((s) => s.config.widthMode);
  const setViewConfig = useViewConfig((s) => s.setViewConfig);
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

  const panelSnapshotRef = useRef<NotePanelSnapshot | null>(null);

  const cycleWidthMode = () => {
    const next = nextNoteWidthMode(widthMode);

    // Exit the current state. If it had forced a panel layout, put the
    // user's panels back exactly as they were (open flags *and*
    // overrides, so `usePanelSize`'s breakpoint auto-open resumes).
    if (NOTE_WIDTH_STATES[widthMode]?.panels) {
      const snapshot = panelSnapshotRef.current;
      panelSnapshotRef.current = null;
      if (snapshot) {
        setLeftPanelOpen(snapshot.leftOpen);
        setRightPanelOpen(snapshot.rightOpen);
        setLeftPanelUserOverride(snapshot.leftOverride);
        setRightPanelUserOverride(snapshot.rightOverride);
      }
    }

    // Enter the next state. If it forces a panel layout, remember the
    // current layout before applying the target. The user-override
    // flags are pinned so `usePanelSize` can't immediately re-open the
    // panels we just collapsed.
    const target = NOTE_WIDTH_STATES[next]?.panels;
    if (target) {
      panelSnapshotRef.current = {
        leftOpen: leftPanelOpen,
        rightOpen: rightPanelOpen,
        leftOverride: leftPanelUserOverride,
        rightOverride: rightPanelUserOverride,
      };
      setLeftPanelUserOverride(true);
      setRightPanelUserOverride(true);
      setLeftPanelOpen(target.leftOpen);
      setRightPanelOpen(target.rightOpen);
    }

    setViewConfig({ widthMode: next });
  };

  return { widthMode, cycleWidthMode };
}
