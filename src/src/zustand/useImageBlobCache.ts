import { create } from "zustand";
import {
  deleteCachedBlob,
  getAllCachedBlobs,
  putCachedBlob,
} from "../utils/imageBlobCache";
import { bgLog, bgLogWarn } from "../utils/bgDebug";

// Image-blob cache backed by IndexedDB. Public methods are async; the
// in-memory map mirrors IDB rows so the hot path is a single Map.get once hydrated.

interface CacheEntry {
  blob: Blob;
  // Re-created on every rehydration. Never stored in IDB.
  objectUrl: string;
  contentType: string;
  fetchedAt: number;
}

interface ImageBlobCacheState {
  byUrl: Map<string, CacheEntry>;
  // In-flight put promises keyed by URL. A concurrent resolve awaits the
  // in-flight write so a read right after a write never observes a stale miss.
  inflight: Map<string, Promise<unknown>>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  // Look up a cached entry for url. Returns null on miss or before hydrate.
  resolve: (url: string) => Promise<CacheEntry | null>;
  // Insert or replace the entry for url. Revokes the prior object URL when the
  // bytes differ. Resolves once the IDB write completes (best-effort on failure).
  put: (url: string, blob: Blob) => Promise<CacheEntry>;
  // Drop the entry for url and revoke its object URL. Resolves after IDB delete.
  remove: (url: string) => Promise<void>;
}

const replaceEntry = (
  current: CacheEntry | undefined,
  blob: Blob,
  contentType: string,
): CacheEntry => {
  // Revoke the prior object URL only when the blob itself changes. Re-putting
  // the same bytes is a no-op for the URL handle.
  if (current !== undefined && current.blob !== blob) {
    URL.revokeObjectURL(current.objectUrl);
  }
  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
    contentType,
    fetchedAt: Date.now(),
  };
};

export const useImageBlobCacheStore = create<ImageBlobCacheState>()(
  (set, get) => ({
    byUrl: new Map(),
    inflight: new Map(),
    hydrated: false,

    hydrate: async () => {
      if (get().hydrated) return;
      try {
        const persisted = await getAllCachedBlobs();
        bgLog(`hydrate: ${String(persisted.length)} entries read from IDB`);
        const byUrl = new Map<string, CacheEntry>();
        for (const [url, entry] of persisted) {
          byUrl.set(url, {
            blob: entry.blob,
            objectUrl: URL.createObjectURL(entry.blob),
            contentType: entry.contentType,
            fetchedAt: entry.fetchedAt,
          });
        }
        set({ byUrl, hydrated: true });
        bgLog(`hydrate: byUrl populated with ${String(byUrl.size)} entries`);
      } catch (err) {
        // IDB unavailable (private mode, SSR, test env): mark hydrated anyway
        // so reads stop returning a pending promise forever.
        bgLogWarn(`hydrate: IDB read failed, hydrating empty: ${String(err)}`);
        set({ hydrated: true });
      }
    },

    resolve: async (url) => {
      // Read-after-write safety: if a put is in flight, wait for it so a caller
      // that just wrote never observes a miss for the same URL.
      const inflight = get().inflight.get(url);
      if (inflight !== undefined) {
        await inflight;
      }
      return get().byUrl.get(url) ?? null;
    },

    put: async (url, blob) => {
      const contentType = blob.type || "application/octet-stream";
      const work = (async () => {
        const current = get().byUrl.get(url);
        const entry = replaceEntry(current, blob, contentType);
        const next = new Map(get().byUrl);
        next.set(url, entry);
        set({ byUrl: next });
        bgLog(`put: in-memory byUrl set for url=${url}`);
        // Persist to IDB. A failure is logged but does not invalidate the
        // in-memory entry: the in-memory store is the source of truth for this session.
        try {
          await putCachedBlob(url, blob, contentType);
          bgLog(`put: IDB persisted for url=${url}`);
        } catch (err) {
          // Real failure, not a verbose trace: in-memory cache will lose the row
          // on the next reload.
          // eslint-disable-next-line no-console
          console.warn(`[image-blob-cache] IDB put failed for ${url}:`, err);
        }
        return entry;
      })();
      // Track the in-flight write so a concurrent resolve for the same URL waits
      // for it. Hold the promise reference so the slot can be cleared on settle.
      get().inflight.set(url, work);
      try {
        return await work;
      } finally {
        // Clear the slot only if we are still the most recent write for this url;
        // a newer put may have overwritten our slot.
        if (get().inflight.get(url) === work) {
          get().inflight.delete(url);
        }
      }
    },

    remove: async (url) => {
      const current = get().byUrl.get(url);
      if (current !== undefined) {
        URL.revokeObjectURL(current.objectUrl);
        const next = new Map(get().byUrl);
        next.delete(url);
        set({ byUrl: next });
      }
      try {
        await deleteCachedBlob(url);
      } catch {
        // ignore: cache cleanup is best-effort
      }
    },
  }),
);
