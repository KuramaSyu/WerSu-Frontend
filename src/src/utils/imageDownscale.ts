/**
 * Downscale a user-picked image so it fits within a 1080p envelope
 * (long edge <= 1920px) and re-encode as WebP. Keeps the on-disk
 * blob and the IndexedDB cache copy small enough that the
 * background does not eat hundreds of MB per image.
 *
 * Returns a fresh Blob plus the chosen content type. The caller
 * is responsible for persisting the result and for revoking any
 * object URL it created from the input.
 */
const MAX_LONG_EDGE = 1920;
const WEBP_QUALITY = 0.85;
const OUTPUT_TYPE = "image/webp";

export interface DownscaledImage {
  blob: Blob;
  contentType: string;
  width: number;
  height: number;
}

export async function downscaleImageTo1080p(
  file: Blob,
): Promise<DownscaledImage> {
  if (typeof document === "undefined") {
    throw new Error("downscaleImageTo1080p requires a browser environment");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not allocate a 2D canvas context");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), OUTPUT_TYPE, WEBP_QUALITY);
    });
    if (blob === null) {
      throw new Error("Canvas refused to encode the image as WebP");
    }
    return { blob, contentType: OUTPUT_TYPE, width, height };
  } finally {
    bitmap.close();
  }
}
