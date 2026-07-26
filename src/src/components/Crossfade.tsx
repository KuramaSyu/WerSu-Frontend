import { Box } from "@mui/material";

/**
 * Renders two layers stacked at the same position and crossfades
 * between them based on `loading`.
 *
 * Layout:
 * - `children` (the "ready" layer) is always rendered once the
 *   component is mounted. It drives the layout height - it sits in
 *   the normal flow so siblings know its size.
 * - `loadingChildren` (the "pending" layer) is rendered on top of
 *   the ready layer with `position: absolute; inset: 0`. It does not
 *   influence layout. `pointerEvents: none` keeps it from swallowing
 *   clicks even while still painted.
 *
 * Transition:
 * - Both layers animate `opacity` over `duration` (defaults to
 *   `theme.transitions.duration.standard`).
 * - While `loading` is true: ready is `opacity: 0`, pending is
 *   `opacity: 1`. When loading flips false, both transitions run
 *   simultaneously, producing a crossfade.
 *
 * Mounting:
 * - The pending layer is unmounted once loading flips false and the
 *   fade completes. The parent should keep its own state long enough
 *   for the fade-out to play - typical usage doesn't need any extra
 *   delay because the transition runs on CSS only.
 */
export interface CrossfadeProps {
  /** When true, the pending layer is shown on top of the ready layer. */
  loading: boolean;
  /** Always rendered (once mounted). Drives layout. Fades in. */
  children: React.ReactNode;
  /** Rendered only while `loading`. Fades out. */
  loadingChildren: React.ReactNode;
  /**
   * Fade duration in milliseconds. Defaults to the theme's standard
   * transition duration (~250ms in the MUI default).
   */
  duration?: number;
}

export const Crossfade: React.FC<CrossfadeProps> = ({
  loading,
  children,
  loadingChildren,
  duration,
}) => {
  const transition = (theme: import("@mui/material/styles").Theme) =>
    theme.transitions.create("opacity", {
      duration: duration ?? theme.transitions.duration.standard,
    });

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        sx={{
          opacity: loading ? 0 : 1,
          transition,
        }}
      >
        {children}
      </Box>
      {loading && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 1,
            pointerEvents: "none",
            transition,
          }}
        >
          {loadingChildren}
        </Box>
      )}
    </Box>
  );
};
