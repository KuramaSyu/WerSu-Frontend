import type { NoteWidthMode } from "../../../api/models/ViewConfig";
import {
  NOTE_EDITOR_A4_WIDTH,
  NOTE_EDITOR_WIDE_WIDTH,
} from "../../../statics";

/**
 * Panel layout a width preset wants while it is active.
 *
 * `null` (on the parent `NoteWidthState.panels`) means "leave the
 * panels exactly as the user left them".
 */
export interface NoteWidthPanelTarget {
  leftOpen: boolean;
  rightOpen: boolean;
}

/**
 * One editor-width state.
 *
 * This is the data half of the state pattern: the toggle, the width
 * resolver and the transition layer read everything they need from
 * here, so adding a preset means adding one entry (plus an icon in the
 * React layer), not editing branches in three places.
 *
 * Note it deliberately does *not* carry `prevPanelStates`: previous
 * layout is transition history, not a property of a mode, and this
 * table is a shared singleton. See `useNoteWidthMode` for where that
 * history actually lives.
 */
export interface NoteWidthState {
  id: NoteWidthMode;
  /** Human-readable label, e.g. "Normal". */
  label: string;
  /** Tooltip copy shown on hover, e.g. "Current: Normal". */
  tooltip: string;
  /** Editor body width while this state is active. */
  bodyWidth: string;
  /** Surrounding paper-card width while this state is active. */
  paperWidth: string;
  /** Panel layout this state forces, or `null` to leave panels alone. */
  panels: NoteWidthPanelTarget | null;
}

/**
 * Ordered cycle for the editor width toggle:
 * `normal -> wide -> full -> normal`.
 */
export const NOTE_WIDTH_MODES: readonly NoteWidthMode[] = [
  "normal",
  "wide",
  "full",
];

/**
 * The three width states.
 *
 * `normal` and `wide` are pure reading-width presets and don't touch
 * the rails. `full` has to reclaim the rails' space or it can end up
 * *narrower* than `wide` (the canvas shrinks by the open panel widths),
 * so it collapses both panels; the transition layer restores the
 * previous layout on the way out.
 */
export const NOTE_WIDTH_STATES: Record<NoteWidthMode, NoteWidthState> = {
  normal: {
    id: "normal",
    label: "Normal",
    tooltip: "Current: Normal",
    bodyWidth: NOTE_EDITOR_A4_WIDTH,
    paperWidth: `calc(${NOTE_EDITOR_A4_WIDTH} + 1rem)`,
    panels: null,
  },
  wide: {
    id: "wide",
    label: "Wide",
    tooltip: "Current: Wide",
    // Cap at the canvas so a 75rem column can never overflow a narrow
    // viewport (with rails open the canvas can be well under 75rem).
    bodyWidth: `min(${NOTE_EDITOR_WIDE_WIDTH}, 100%)`,
    paperWidth: `min(calc(${NOTE_EDITOR_WIDE_WIDTH} + 1rem), 100%)`,
    panels: null,
  },
  full: {
    id: "full",
    label: "Full",
    tooltip: "Current: Full",
    bodyWidth: "100%",
    paperWidth: "100%",
    panels: { leftOpen: false, rightOpen: false },
  },
};

/**
 * Advanced to the next preset in `NOTE_WIDTH_MODES`, wrapping around.
 * Falls back to `normal` for an unknown value so a stale value can
 * never wedge the toggle.
 */
export const nextNoteWidthMode = (mode: NoteWidthMode): NoteWidthMode => {
  const index = NOTE_WIDTH_MODES.indexOf(mode);
  return NOTE_WIDTH_MODES[(index + 1) % NOTE_WIDTH_MODES.length] ?? "normal";
};

export interface NoteEditorWidths {
  /** Width for the editor body (rich/source surfaces). */
  body: string;
  /** Width for the surrounding paper card. */
  paper: string;
}

/**
 * Resolve the body and paper widths for a preset. Mobile
 * (`forceFullWidth`) always spans the canvas; otherwise the preset's
 * own widths are used.
 */
export const getNoteEditorWidths = (
  mode: NoteWidthMode,
  forceFullWidth: boolean,
): NoteEditorWidths => {
  if (forceFullWidth) {
    return { body: "100%", paper: "100%" };
  }
  const state = NOTE_WIDTH_STATES[mode] ?? NOTE_WIDTH_STATES.normal;
  return { body: state.bodyWidth, paper: state.paperWidth };
};
