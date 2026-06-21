import React from "react";
import { Box, keyframes } from "@mui/material";

/**
 * RotatingStrokeBox
 * ------------------
 * - Renders `children` centered inside a box, rotated continuously using
 *   theme.transitions.easing.easeInOut.
 * - A circular conic-gradient ("the circle") spins in the background in the
 *   OPPOSITE direction, also with easeInOut.
 * - A CSS mask (mask-composite: exclude) clips that spinning circle down to
 *   just a thin ring around the box's edge, so all you actually see is a
 *   soft colored stroke that appears to travel around the perimeter.
 *
 * All styling is done via each Box's `sx` prop (no styled() wrapper).
 *
 * Props:
 *  - color: the stroke/accent color (also drives a subtle glow)
 *  - strokeWidth: thickness of the traveling stroke, in px
 *  - size: width/height of the box, in px
 *  - borderRadius: corner radius of the box
 *  - children: content to render in the center (gets the counter-rotation)
 */

// Background "circle" spin — clockwise
const spinCW = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

// Child spin — counter-clockwise (opposite direction)
const spinCCW = keyframes`
  from { transform: rotate(360deg); }
  to   { transform: rotate(0deg); }
`;

export default function RotatingStrokeBox({
  color = "#7c4dff",
  strokeWidth = 3,
  size = 160,
  borderRadius = 16,
  children,
}: {
  color?: string;
  strokeWidth?: number;
  size?: number;
  borderRadius?: number;
  children?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        width: size,
        height: size,
        borderRadius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        isolation: "isolate", // keeps z-index stacking local to this component
        // overflow
      }}
    >
      {/* Soft glow echoing the stroke color, sits behind everything */}
      <Box
        sx={{
          position: "absolute",
          inset: -8,
          borderRadius,
          background: color,
          filter: "blur(24px)",
          opacity: 0.25,
          zIndex: -1,
        }}
      />

      {/* The element that produces the moving stroke. It draws a full
          conic-gradient "circle" the size of the box, rotates it, then
          masks it down to a ring using the padding + mask-composite:exclude
          technique (two mask layers — content-box vs border-box —
          subtracted from each other leave only the stroke visible). */}
      <Box
        sx={(theme) => ({
          position: "absolute",
          inset: 0,
          borderRadius,
          padding: `${strokeWidth}px`, // defines the ring thickness
          background: `conic-gradient(from 0deg, transparent 0deg, ${color} 90deg, transparent 200deg, transparent 360deg)`,

          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",

          // Background "circle" rotates with theme-driven easeInOut.
          // duration.complex (375ms) is scaled up since it's meant for UI
          // transitions, not a full 360deg sweep — tune the factor to taste.
          animation: `${spinCW} ${theme.transitions.duration.complex * 4}ms ${
            theme.transitions.easing.easeInOut
          } infinite`,
          pointerEvents: "none",
        })}
      />

      {/* Child layer — rotates the opposite direction of the background
          circle, also via theme.transitions.easing.easeInOut */}
      <Box
        sx={(theme) => ({
          position: "relative",
          zIndex: 1,
          display: "inline-flex",
          animation: `${spinCCW} ${theme.transitions.duration.complex * 4}ms ${
            theme.transitions.easing.easeInOut
          } infinite`,
        })}
      >
        {children}
      </Box>
    </Box>
  );
}
