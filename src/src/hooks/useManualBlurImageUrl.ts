import { useEffect, useState } from "react";

import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";
import { blurImageToWebp, fetchImageBlob } from "../utils/imageBlur";
import {
  SYNCED_THEME_IMAGE_WIDTH_DESKTOP,
  SYNCED_THEME_IMAGE_WIDTH_MOBILE,
  syncedOriginalCacheKey,
  toAttachmentImageUrl,
} from "../utils/syncedThemeImages";
import { useBreakpoint } from "./useBreakpoint";

/**
 * Resolve a theme background the "manual" way: fetch the sharp source at
 * display resolution (1080p desktop / 720p mobile) and blur it with a canvas
 * transform in the browser, instead of reading a pre-rendered blurred blob
 * from IndexedDB.
 *
 * This is the alternative to the default two-copy cache strategy toggled by
 * `FeatureFlagName.PreRenderThemeBlur`. Nothing is persisted here: the result
 * lives as an in-memory object URL for as long as the source/blur pair is
 * mounted. A device-local (`local:<id>`) source is read from the blob cache
 * because there is no API to fetch it from; everything else is fetched
 * straight from the backend image endpoint at the requested width.
 *
 * Returns `null` while the image is loading or when the source is empty /
 * blur is disabled, so the caller can render nothing rather than the sharp
 * source.
 */
export function useManualBlurImageUrl(
  source: string,
  blur: number,
): string | null {
  const { isMobile } = useBreakpoint();
  const width = isMobile
    ? SYNCED_THEME_IMAGE_WIDTH_MOBILE
    : SYNCED_THEME_IMAGE_WIDTH_DESKTOP;
  const hydrated = useImageBlobCacheStore((s) => s.hydrated);
  // Subscribe to the sharp bytes that the sync/repair pass writes into the
  // cache. A downloaded theme is registered before its source is cached, so
  // the first effect run may need the network; this subscription re-runs it
  // once the cached source lands, making the theme behave like a device-local
  // one (and retrying when an early fetch failed).
  const cachedSourceBlob = useImageBlobCacheStore((s) =>
    source.length > 0 ? (s.byUrl.get(source)?.blob ?? null) : null,
  );
  const cachedOriginalBlob = useImageBlobCacheStore((s) =>
    source.length > 0
      ? (s.byUrl.get(syncedOriginalCacheKey(source))?.blob ?? null)
      : null,
  );
  // Store the rendered URL together with the request it belongs to. The
  // returned value is derived from the current request key, so switching the
  // source/blur (or disabling the hook) yields `null` without a synchronous
  // state write in the effect.
  const [rendered, setRendered] = useState<{
    key: string;
    url: string;
  } | null>(null);

  const requestKey = `${source}|${String(blur)}|${String(width)}`;

  useEffect(() => {
    if (source.length === 0 || blur <= 0) {
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const blob = await readSourceBlob(source, width, hydrated);
        if (blob === null) {
          if (!cancelled) {
            setRendered(null);
          }
          return;
        }
        const blurred = await blurImageToWebp(blob, blur);
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blurred);
        setRendered({ key: requestKey, url: objectUrl });
      } catch (err) {
        console.warn(`[image-cache] manual blur failed for ${source}:`, err);
        if (!cancelled) {
          setRendered(null);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    source,
    blur,
    width,
    hydrated,
    requestKey,
    cachedSourceBlob,
    cachedOriginalBlob,
  ]);

  return rendered !== null && rendered.key === requestKey
    ? rendered.url
    : null;
}

/**
 * Read the sharp bytes for a manual-blur render.
 *
 * Device-local blobs come from the IndexedDB cache (waiting for hydration).
 * Remote sources prefer the sharp bytes the sync/repair pass already cached
 * — so a downloaded theme behaves like a device-local one — and only fetch a
 * width-capped variant (`width`) when the cache is cold. The fetched result
 * is intentionally not persisted, so the blurred copy never enters
 * IndexedDB.
 */
async function readSourceBlob(
  source: string,
  width: number,
  hydrated: boolean,
): Promise<Blob | null> {
  const cache = useImageBlobCacheStore.getState();
  if (source.startsWith("local:")) {
    if (!hydrated) {
      return null;
    }
    const entry = await cache.resolve(source);
    return entry?.blob ?? null;
  }

  if (hydrated) {
    const cached =
      (await cache.resolve(source)) ??
      (await cache.resolve(syncedOriginalCacheKey(source)));
    if (cached !== null) {
      return cached.blob;
    }
  }

  try {
    return await fetchImageBlob(toAttachmentImageUrl(source, width));
  } catch (err) {
    // The width rebuild can fail for a non-attachment / external source.
    // Fall back to the stored URL exactly as-is before giving up.
    console.warn(`[image-cache] width-capped fetch failed for ${source}:`, err);
    return await fetchImageBlob(source);
  }
}
