/**
 * Centralized tuning knobs for the file-graph view.
 *
 * The force-graph layout is driven by three d3-force forces plus a
 * handful of `react-force-graph-2d` rendering parameters. Tweaking
 * them in one place keeps the canvas's `useEffect` clean and gives a
 * single spot to dial the look without grepping across the
 * component.
 *
 * Two groupings:
 *
 * - `forceConfig` — values we hand to `d3Force("charge", ...)` /
 *   `d3Force("link", ...)` / `d3Force("collide", ...)` on the
 *   `react-force-graph-2d` instance. They replace d3's defaults
 *   (charge `-30`, link distance `30`, no collide). Going more
 *   negative on `charge` spreads nodes farther apart; lower
 *   `linkDistance` pulls them closer; higher `collideRadius`
 *   inflates the per-node "keep-out" zone.
 *
 * - `renderConfig` — values for the `ForceGraph2D` component itself
 *   (cooldown time, zoom-to-fit padding, FAB spacing). Independent
 *   of the simulation; safe to tweak without re-seating the layout.
 *
 * `undefined` = use d3's default
 *
 * Every d3-force value in `ForceConfig` may be set to `undefined`,
 * which tells the canvas to skip the corresponding setter and let
 * d3's built-in default kick in. This lets you A/B test by
 * commenting out a single line without redeclaring the value type.
 * For example, `linkStrength: undefined` reverts to d3's
 * node-count-derived strength.
 */

import type { Theme } from "@mui/material/styles";

/**
 * Tuning for the three d3 forces we override.
 *
 * Defaults from the library are noted in JSDoc for reference. We
 * picked tighter values so a project with hundreds of notes / dirs
 * still fits the canvas without panning.
 */
export interface ForceConfig {
  /**
   * Per-node charge (repulsion). Negative = push apart.
   * d3 default: `-30`. Set to `undefined` to keep the default.
   */
  chargeStrength: number | undefined;
  /**
   * Target spring length between connected nodes (graph units).
   * d3 default: `30`. Set to `undefined` to keep the default.
   */
  linkDistance: number | undefined;
  /**
   * Spring stiffness (0..1). Higher = pulls harder toward
   * `linkDistance`. d3 default: derived from node count; set to
   * `undefined` to keep that dynamic default, or pin to a constant
   * for a consistent layout regardless of graph size.
   */
  linkStrength: number | undefined;
  /**
   * Per-node collide radius — soft "keep-out" zone around each
   * node. d3 default: none (no collide force at all). Set to a
   * number to install a collide force; `undefined` skips the force
   * entirely so d3's "no collide" default is preserved.
   */
  collideRadius: number | undefined;
}

/**
 * Rendering knobs for the `<ForceGraph2D>` component.
 *
 * These don't affect the simulation; they only change how the
 * rendered output looks / feels. None of these have a "use the
 * library default" path — they're consumed verbatim by the React
 * component — so the values are typed as plain `number`.
 */
export interface RenderConfig {
  /**
   * Cooldown time (ms) after which the simulation is considered
   * settled and stops ticking. Default in the library is `15000`;
   * we keep it shorter so re-renders feel snappy.
   */
  cooldownTimeMs: number;
  /**
   * Number of warmup ticks the simulation runs before the first
   * render. Higher values produce a more settled initial layout at
   * the cost of a longer first paint.
   */
  warmupTicks: number;
  /**
   * Padding (px) around the rendered graph when the anchor FAB
   * zoom-to-fits. Higher = more whitespace at the canvas edges.
   */
  zoomToFitPaddingPx: number;
  /**
   * Duration (ms) of the camera transition used by the anchor FAB
   * and on mode/depth changes.
   */
  anchorDurationMs: number;
  /**
   * Spacing (px) between the anchor FAB and the canvas corner.
   * Applies to both top and right edges.
   */
  fabInsetPx: number;
}

/**
 * Static, theme-agnostic tuning for the three d3 forces.
 *
 * Flip any field to `undefined` to fall back to d3's default for
 * that specific force — see the `ForceConfig` JSDoc above.
 */
export const forceConfig: ForceConfig = {
  chargeStrength: undefined,
  linkDistance: undefined,
  linkStrength: undefined,
  collideRadius: undefined,
};

/**
 * Static, theme-agnostic tuning for the `<ForceGraph2D>` renderer.
 */
export const renderConfig: RenderConfig = {
  cooldownTimeMs: 1500,
  warmupTicks: 60,
  zoomToFitPaddingPx: 40,
  anchorDurationMs: 600,
  fabInsetPx: 16,
};

/**
 * Theme-derived colors for the canvas. Kept here so a future
 * re-theme flows through one file rather than three.
 */
export function graphPalette(theme: Theme): {
  directory: string;
  noteBase: string;
  text: string;
} {
  return {
    directory: theme.palette.primary.main,
    noteBase: theme.palette.secondary.main,
    text: theme.palette.text.primary,
  };
}
