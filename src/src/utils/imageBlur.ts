/**
 * Pre-render a blurred variant of a background image.
 *
 * Blurring a full-resolution image with a CSS filter on every frame is
 * expensive, so generated themes persist a separate blurred blob
 * instead. The blur amount is expressed as a percentage (0-100) and
 * mapped onto a fixed pixel radius so a given percentage looks the same
 * regardless of the source dimensions.
 */

import { BACKEND_BASE } from "../statics";
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

/**
 * True when `url` targets our own backend (the configured `BACKEND_BASE`
 * origin or a backend-relative path). Credentials are only attached to those
 * requests: sending them to third-party image hosts makes the browser reject
 * responses whose `Access-Control-Allow-Origin` is the `*` wildcard.
 */
function isBackendImageUrl(url: string): boolean {
  if (url.startsWith("/")) {
    return true;
  }
  if (BACKEND_BASE.length === 0) {
    return false;
  }
  try {
    return new URL(url).origin === new URL(BACKEND_BASE).origin;
  } catch {
    return false;
  }
}

/** Fetch a remote image into a Blob (used for URL-sourced themes). */
export async function fetchImageBlob(url: string): Promise<Blob> {
  const target = normalizeImageUrl(url);
  const response = await fetch(target, {
    mode: "cors",
    // Attachment images are auth-protected. The default `same-origin`
    // credentials mode drops the session cookie on the cross-origin backend
    // request, so the image endpoint answers 401.
    credentials: isBackendImageUrl(target) ? "include" : "same-origin",
  });
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

interface LoadedDrawable {
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/**
 * Decode a blob for canvas drawing. `createImageBitmap` is the fast path;
 * older WebKit builds either lack it or reject some image types, so fall
 * back to an object-URL `<img>`.
 */
async function loadDrawable(blob: Blob): Promise<LoadedDrawable> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> path.
    }
  }

  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not decode backdrop image"));
      image.src = url;
    });
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  return {
    image,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    close: () => URL.revokeObjectURL(url),
  };
}

export interface ViewportBlurImage {
  blob: Blob;
  /** Rendered CSS-pixel width of the image, including the padded border. */
  width: number;
  /** Rendered CSS-pixel height of the image, including the padded border. */
  height: number;
  /** Distance from the viewport origin to the image origin. */
  offsetX: number;
  offsetY: number;
}

/**
 * Bake a viewport-sized, blurred copy of a theme background.
 *
 * The note editor paints this image behind its frosted card instead of
 * using `backdrop-filter` or a live CSS `filter`. Both of those re-run the
 * blur shader whenever the card moves (scrolling, top-bar hide/reveal),
 * which is expensive on WebKit. A baked image only needs to be copied.
 *
 * The canvas is padded by twice the blur radius so the filter's
 * transparent edge fade sits outside the visible viewport. Callers should
 * paint it at the returned size/offset on a stationary fixed layer.
 */
export async function blurImageToViewportWebp(
  source: string,
  blurPx: number,
  viewportWidth: number,
  viewportHeight: number,
): Promise<ViewportBlurImage> {
  if (typeof document === "undefined") {
    throw new Error("blurImageToViewportWebp requires a browser environment");
  }
  const blur = Math.max(1, blurPx);
  const offset = Math.ceil(blur * 2);
  const width = Math.max(1, Math.round(viewportWidth)) + offset * 2;
  const height = Math.max(1, Math.round(viewportHeight)) + offset * 2;

  const sourceBlob =
    source.startsWith("blob:") || source.startsWith("data:")
      ? await (await fetch(source)).blob()
      : await fetchImageBlob(source);
  const drawable = await loadDrawable(sourceBlob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not allocate a 2D canvas context");
    }

    ctx.filter = `blur(${blur}px)`;
    const scale = Math.max(width / drawable.width, height / drawable.height);
    const drawWidth = drawable.width * scale;
    const drawHeight = drawable.height * scale;
    ctx.drawImage(
      drawable.image,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );

    const toBlob = (type: string): Promise<Blob | null> =>
      new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), type, WEBP_QUALITY);
      });
    // Safari has historically refused WebP canvas encoding. The baked
    // backdrop is a one-off image, so falling back to PNG is cheap enough
    // and keeps the feature working there.
    const blob = (await toBlob(OUTPUT_TYPE)) ?? (await toBlob("image/png"));
    if (blob === null) {
      throw new Error("Canvas refused to encode the blurred backdrop");
    }
    blurLog(
      `editor backdrop done blur=${String(blurPx)}px size=${String(blob.size)} bytes`,
    );
    return {
      blob,
      width,
      height,
      offsetX: offset,
      offsetY: offset,
    };
  } finally {
    drawable.close();
  }
}
