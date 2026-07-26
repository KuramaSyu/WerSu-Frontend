import { Box } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";

/**
 * Wipes its child in from left to right with an `ease-in-out`
 * transition, and wipes it back out (mirrored) when `in` flips to
 * false. Re-trigger by changing the `key` prop on the parent.
 *
 * Implementation: `clip-path: inset(0 X% 0 0)` where X is the right
 * edge's inset. Animating X from 100% (fully clipped) to 0% (fully
 * revealed) sweeps a leading edge across the child. The leading
 * edge reads as a moving gradient at typical durations (~300-600ms)
 * even though `clip-path` itself is hard-edged.
 *
 * Layout:
 * - The child takes the component's full size. `overflow: hidden`
 *   on the wrapper clips anything that bleeds past the box while
 *   the reveal is in progress.
 * - `display: inline-block` lets the wrapper shrink to the child's
 *   intrinsic size so a parent flex/grid layout isn't disrupted by
 *   a phantom 100% width.
 *
 * Re-triggering:
 * - The animation is driven by the CSS transition on `clip-path`,
 *   which fires whenever the value changes. Pass a `key` to the
 *   component (or change its position in the tree) and the new
 *   mount starts with `in=false` then flips to `in=true` via the
 *   parent - that triggers the wipe-in. To wipe out, flip `in`
 *   back to false on the same instance.
 */
export interface GradientRevealProps {
  /** When true, the child is revealed. When false, it's clipped away. */
  in: boolean;
  /** Always rendered. Wiped in/out by the `in` flag. */
  children: React.ReactNode;
  /**
   * Animation duration in milliseconds. Defaults to 500ms - long
   * enough for the gradient effect to read clearly.
   */
  duration?: number;
}

export const GradientReveal: React.FC<GradientRevealProps> = ({
  in: inProp,
  children,
  duration = undefined,
}) => {
  const { theme } = useThemeStore();
  // Animate the right edge of `clip-path`. ease-in-out matches
  // MUI's `easing.easeInOut`: cubic-bezier(0.4, 0, 0.2, 1).
  const transition = theme.transitions.create("clip-path", {
    duration: duration ?? theme.transitions.duration.standard,
    easing: theme.transitions.easing.easeInOut,
  });

  return (
    <Box
      sx={{
        display: "inline-block",
        overflow: "hidden",
        clipPath: inProp ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
        transition,
      }}
    >
      {children}
    </Box>
  );
};
