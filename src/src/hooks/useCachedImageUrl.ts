import { useEffect } from "react";
import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";
import { fetchImageBlob } from "../utils/imageBlur";

/**
 * Resolve a theme background image to an object URL backed by IndexedDB.
 *
 * Render contract: check the (in-memory mirror of the) blob cache. A hit
 * yields the cached object URL; a miss schedules a one-shot download that
 * persists the blob to IndexedDB so the next render is a pure cache hit.
 *
 * `local:<id>` keys are blobs that were written directly to IndexedDB at
 * creation time, so a miss means the bytes are gone (index cleared,
 * another browser/device) and there is nothing to fetch. Remote URLs fall
 * back to the network URL until the download lands so a theme never
 * renders an empty background.
 */
export function useCachedImageUrl(url: string): string | null {
  const cached = useImageBlobCacheStore((s) =>
    url.length > 0 ? (s.byUrl.get(url)?.objectUrl ?? null) : null,
  );
  const hydrated = useImageBlobCacheStore((s) => s.hydrated);
  const put = useImageBlobCacheStore((s) => s.put);

  const isLocal = url.startsWith("local:");

  useEffect(() => {
    // Cache hit, empty slot, device-local key, or cache not hydrated yet:
    // there is nothing to download.
    if (url.length === 0 || cached !== null || isLocal || !hydrated) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const blob = await fetchImageBlob(url);
        if (!cancelled) {
          await put(url, blob);
        }
      } catch (err) {
        // CORS / offline / 404: keep the raw URL fallback. The effect will
        // not retry on its own because `cached` stays null and the deps
        // are unchanged.
        console.warn(`[image-cache] could not cache ${url}:`, err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, cached, isLocal, hydrated, put]);

  if (url.length === 0) {
    return null;
  }
  if (isLocal) {
    return cached;
  }
  return cached ?? url;
}
