import type { ImageResizeStrategy } from "./imageResizeStrategy";

// The eight resize handles shown around a selected image. The string
// encodes the active edges: "nw" = top-left, "e" = right edge, etc.
export const IMAGE_RESIZE_HANDLES = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
] as const;

export type ImageResizeHandle = (typeof IMAGE_RESIZE_HANDLES)[number];

export interface ComputeResizeInput {
  handle: ImageResizeHandle;
  dx: number;
  dy: number;
  startWidth: number;
  startHeight: number;
  aspectRatio: number;
  /** When true the aspect ratio is preserved for every handle. */
  locked: boolean;
  min?: number;
}

/**
 * Translate a pointer delta into the next pixel dimensions of the image.
 *
 * Locked corners scale uniformly, locked edge handles scale the other
 * axis proportionally. Unlocked corners move both axes independently and
 * unlocked edge handles stretch a single axis.
 */
export function computeResize({
  handle,
  dx,
  dy,
  startWidth,
  startHeight,
  aspectRatio,
  locked,
  min = 24,
}: ComputeResizeInput): { width: number; height: number } {
  const hasEast = handle.includes("e");
  const hasWest = handle.includes("w");
  const hasNorth = handle.includes("n");
  const hasSouth = handle.includes("s");
  const horizontal = hasEast || hasWest;
  const vertical = hasNorth || hasSouth;

  let width = startWidth;
  let height = startHeight;

  if (horizontal) width = startWidth + (hasEast ? dx : -dx);
  if (vertical) height = startHeight + (hasSouth ? dy : -dy);

  if (locked && aspectRatio > 0) {
    if (horizontal && vertical) {
      const scaleX = width / startWidth;
      const scaleY = height / startHeight;
      const scale = Math.abs(scaleX) > Math.abs(scaleY) ? scaleX : scaleY;
      width = startWidth * scale;
      height = startHeight * scale;
    } else if (horizontal) {
      height = width / aspectRatio;
    } else if (vertical) {
      width = height * aspectRatio;
    }
  }

  // Clamp to the minimum, keeping the ratio when locked.
  if (width < min) width = min;
  if (height < min) height = min;
  if (locked && aspectRatio > 0) {
    if (horizontal && !vertical) height = width / aspectRatio;
    else if (vertical && !horizontal) width = height * aspectRatio;
    else {
      // Corner: scale down together if either axis fell below the min.
      const scale = Math.min(
        1,
        width / Math.max(startWidth, Number.EPSILON),
        height / Math.max(startHeight, Number.EPSILON),
      );
      if (scale < 1) {
        width = startWidth * scale;
        height = startHeight * scale;
      }
    }
    if (width < min) {
      width = min;
      height = width / aspectRatio;
    }
    if (height < min) {
      height = min;
      width = height * aspectRatio;
    }
  }

  return { width, height };
}

/** Build the geometry to persist from a finished pixel drag. */
export function geometryFromPixels(
  strategy: ImageResizeStrategy,
  pixels: { width: number; height: number; aspectRatio: number },
  locked: boolean,
) {
  return strategy.fromPixels({ ...pixels, locked });
}
