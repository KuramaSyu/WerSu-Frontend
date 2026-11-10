import type { WidthMode } from "../../api/models/ViewConfig";

/**
 * One shelf-content width preset.
 *
 * `contentWidth` is the CSS `max-width` applied to the tab body that
 * hosts Settings / Rules / Permissions, so all three tabs line up no
 * matter which preset is active.
 */
export interface ShelfWidthState {
  id: WidthMode;
  /** Human-readable label, e.g. "Normal". */
  label: string;
  /** Tooltip copy shown on hover, e.g. "Current: Normal". */
  tooltip: string;
  /** `max-width` for the shelf tab body while this state is active. */
  contentWidth: string;
}

/**
 * Ordered cycle for the shelf width toggle:
 * `normal -> wide -> full -> normal`.
 */
export const SHELF_WIDTH_MODES: readonly WidthMode[] = [
  "normal",
  "wide",
  "full",
];

/**
 * The three shelf width states.
 *
 * Kept in `rem`/`clamp` (never fixed pixels) so the column stays
 * readable on small screens and the `full` preset can span the whole
 * canvas.
 */
export const SHELF_WIDTH_STATES: Record<WidthMode, ShelfWidthState> = {
  normal: {
    id: "normal",
    label: "Normal",
    tooltip: "Current: Normal",
    contentWidth: "clamp(20rem, 100%, 48rem)",
  },
  wide: {
    id: "wide",
    label: "Wide",
    tooltip: "Current: Wide",
    contentWidth: "clamp(20rem, 100%, 72rem)",
  },
  full: {
    id: "full",
    label: "Full",
    tooltip: "Current: Full",
    contentWidth: "100%",
  },
};

/**
 * Advanced to the next preset in `SHELF_WIDTH_MODES`, wrapping around.
 * Falls back to `normal` for an unknown value so a stale value can
 * never wedge the toggle.
 */
export const nextShelfWidthMode = (mode: WidthMode): WidthMode => {
  const index = SHELF_WIDTH_MODES.indexOf(mode);
  return (
    SHELF_WIDTH_MODES[(index + 1) % SHELF_WIDTH_MODES.length] ?? "normal"
  );
};
