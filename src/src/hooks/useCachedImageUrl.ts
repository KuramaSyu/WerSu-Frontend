import { useEffect } from "react";
import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";
import { fetchImageBlob } from "../utils/imageBlur";
import {
  cacheSyncedThemeImageFallback,
  toAttachmentImageUrl,
} from "../utils/syncedThemeImages";

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
  // Stored theme backgrounds may still use the legacy `/attachments/<key>`
  // shape, which has no backend route. Normalise attachment references to
  // the image endpoint before caching/fetching so the persisted URL and
  // the object URL agree.
  const resolvedUrl = toAttachmentImageUrl(url);
  const cached = useImageBlobCacheStore((s) =>
    resolvedUrl.length > 0
      ? (s.byUrl.get(resolvedUrl)?.objectUrl ?? null)
      : null,
  );
  const hydrated = useImageBlobCacheStore((s) => s.hydrated);
  const put = useImageBlobCacheStore((s) => s.put);

  const isLocal = resolvedUrl.startsWith("local:");

  useEffect(() => {
    // Cache hit, empty slot, device-local key, or cache not hydrated yet:
    // there is nothing to download.
    if (
      resolvedUrl.length === 0 ||
      cached !== null ||
      isLocal ||
      !hydrated
    ) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const blob = await fetchImageBlob(resolvedUrl);
        if (!cancelled) {
          await put(resolvedUrl, blob);
        }
      } catch (err) {
        // Direct download failed (CORS / offline / a stale/deformed source).
        // Repair from the attachment image endpoint when the source is one of
        // our attachments: the backend can regenerate a compressed variant
        // from the stored object, so the theme still renders instead of
        // showing nothing. The full-resolution original is left untouched, so
        // opening the editor upgrades the pixels on the next edit.
        console.warn(`[image-cache] could not cache ${resolvedUrl}:`, err);
        if (!cancelled) {
          await cacheSyncedThemeImageFallback(resolvedUrl);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedUrl, cached, isLocal, hydrated, put]);

  if (resolvedUrl.length === 0) {
    return null;
  }
  if (isLocal) {
    return cached;
  }
  return cached ?? resolvedUrl;
}
