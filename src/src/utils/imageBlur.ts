/**
 * Pre-render a blurred variant of a background image.
 *
 * Blurring a full-resolution image with a CSS filter on every frame is
 * expensive, so generated themes persist a separate blurred blob
 * instead. The blur amount is expressed as a percentage (0-100) and
 * mapped onto a fixed pixel radius so a given percentage looks the same
 * regardless of the source dimensions.
 */

import { FeatureFlagName, useFeatureStore } from "../zustand/FeatureStore";
import { normalizeImageUrl } from "./imageUrl";

const blurLog = (message: string): void => {
  const enabled =
    useFeatureStore.getState().flags[FeatureFlagName.BlurredBackgroundDebug];
  if (!enabled) {
    return;
  }
  console.debug(`[blur] ${message}`);
};

const MAX_BLUR_PX = 40;
const WEBP_QUALITY = 0.85;
const OUTPUT_TYPE = "image/webp";

/** Fetch a remote image into a Blob (used for URL-sourced themes). */
export async function fetchImageBlob(url: string): Promise<Blob> {
  const response = await fetch(normalizeImageUrl(url), { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Failed to fetch image (HTTP ${response.status})`);
  }
  return await response.blob();
}

/**
 * Draw `source` to a canvas with a blur filter and re-encode as WebP.
 * The image is overscanned slightly before blurring so the filter's
 * transparent edge fade does not show up as a dark vignette.
 */
export async function blurImageToWebp(
  source: Blob,
  blurPercent: number,
): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("blurImageToWebp requires a browser environment");
  }
  const percent = Math.max(0, Math.min(100, blurPercent));
  blurLog(`generate start blur=${String(percent)}%`);
  const bitmap = await createImageBitmap(source);
  try {
    const { width, height } = bitmap;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not allocate a 2D canvas context");
    }

    const blurPx = (percent / 100) * MAX_BLUR_PX;
    ctx.filter = `blur(${blurPx}px)`;
    // Scale up so the blurred image still covers the whole canvas.
    const overscan = 1 + (blurPx * 2) / Math.min(width, height);
    const drawWidth = width * overscan;
    const drawHeight = height * overscan;
    ctx.drawImage(
      bitmap,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), OUTPUT_TYPE, WEBP_QUALITY);
    });
    if (blob === null) {
      throw new Error("Canvas refused to encode the image as WebP");
    }
    blurLog(
      `generate done blur=${String(percent)}% size=${String(blob.size)} bytes`,
    );
    return blob;
  } finally {
    bitmap.close();
  }
}
