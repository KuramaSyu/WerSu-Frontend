// ---------------------------------------------------------------------------
// collabCache
// Shared cache mechanics for the private and public Hocuspocus collab
// flows. The actual provider creation / lifecycle is keyed by noteId
// and lives in the per-flow hook (useNoteCollaboration.ts and
// usePublicNoteCollaboration.ts); this file only owns the cross-flow
// glue: subscription, IndexedDB attach/detach, and the offline-mode
// transitions.
// ---------------------------------------------------------------------------

import * as Y from "yjs";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { collabStatusStore } from "../zustand/useCollabStatusStore";

/**
 * One cache slot per noteId. `persistence` is null until the user
 * (or auto-fallback) opts into offline mode, in which case we attach
 * `y-indexeddb` to keep edits durable in this browser only.
 */
export interface CollabCacheEntry {
  ydoc: Y.Doc;
  /**
   * The full `HocuspocusProvider` instance. Typed as the concrete
   * class so downstream consumers (the editor's collab extensions,
   * the live-users / status bridges) can call any method they need
   * without a cast. The previous structural subset broke
   * `NoteEditorCore`'s prop contract whenever the cache entry was
   * threaded into the editor as a `provider` prop.
   */
  provider: HocuspocusProvider;
  /** IndexedDB persistence attached when the user enters offline mode. */
  persistence: IndexeddbPersistence | null;
  /** Local-only edits accumulated since we last synced with the server. */
  hasUnsyncedLocalEdits: boolean;
  /** Origin of the offline mode, if currently offline. */
  offlineOrigin: "manual" | "auto" | null;
  /** Last time the ydoc changed locally. Used by the conflict modal. */
  lastLocalEditAt: number | null;
  /**
   * Snapshot of the server's markdown at the moment we went offline.
   * Captured from `useNote(noteId)` so the conflict modal can compare
   * "what the server had when I went offline" to "what the server
   * has now" to detect concurrent edits.
   */
  preOfflineCloudMarkdown: string | null;
}

export interface CollabCache<T extends CollabCacheEntry> {
  has: (noteId: string) => boolean;
  get: (noteId: string) => T | undefined;
  set: (noteId: string, entry: T) => void;
  /** Iterate over every entry. Used by token-rotation reconnect loops. */
  forEach: (cb: (entry: T, noteId: string) => void) => void;
  subscribe: (onChange: () => void) => () => void;
}

export function createCollabCache<
  T extends CollabCacheEntry,
>(): CollabCache<T> {
  const cache = new Map<string, T>();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  return {
    has: (noteId) => cache.has(noteId),
    get: (noteId) => cache.get(noteId),
    set: (noteId, entry) => {
      cache.set(noteId, entry);
      emit();
    },
    forEach: (cb) => {
      cache.forEach((entry, noteId) => cb(entry, noteId));
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}

/**
 * Attach an `IndexeddbPersistence` to an existing ydoc. Idempotent
 * (returns the existing persistence if one is already attached). The
 * returned promise resolves when the initial IndexedDB rehydration
 * finishes, so callers can wait for "all local edits are in memory"
 * before reading or comparing state.
 */
export function attachPersistence(
  ydoc: Y.Doc,
  roomName: string,
): { persistence: IndexeddbPersistence; ready: Promise<void> } {
  const persistence = new IndexeddbPersistence(roomName, ydoc);
  const ready = new Promise<void>((resolve) => {
    if (persistence.synced) {
      resolve();
      return;
    }
    persistence.once("synced", () => resolve());
  });
  return { persistence, ready };
}

/**
 * Mark local edits as unsynced. Wire this on the ydoc's `afterTransaction`
 * while in offline mode so we know whether a reconnect has anything
 * to push to the server.
 */
export function markLocalEdits(entry: CollabCacheEntry): void {
  // The afterTransaction listener stays attached for the lifetime of
  // the entry, so it keeps firing after we leave offline mode. Only
  // edits made while offline count as unsynced; otherwise a normal
  // online edit would make the next reconnect look like a conflict.
  if (!entry.offlineOrigin) return;
  entry.hasUnsyncedLocalEdits = true;
  entry.lastLocalEditAt = Date.now();
}

export function clearLocalEdits(entry: CollabCacheEntry): void {
  entry.hasUnsyncedLocalEdits = false;
  entry.lastLocalEditAt = null;
  // The pre-offline snapshot has been consumed; clear it so the next
  // offline session starts fresh.
  entry.preOfflineCloudMarkdown = null;
}

/**
 * Y.Docs that already have the offline edit-marker listener attached.
 * `exitOfflineMode` keeps the entry (and its afterTransaction
 * listener) alive across online sessions, so without this guard every
 * offline cycle would stack another listener on the same doc.
 */
const editListenersAttached = new WeakSet<Y.Doc>();

/**
 * Helper used by both flows: transition a cache entry into offline
 * mode. Attaches IndexedDB if it isn't already, sets the status, and
 * returns the updated entry.
 *
 * `preOfflineCloudMarkdown` should be the live markdown captured at
 * the moment we go offline (from the active-note store). It is the
 * baseline `shouldPromptMergeOnReconnect` compares against to detect
 * net local edits.
 */
export async function enterOfflineMode(
  noteId: string,
  entry: CollabCacheEntry,
  origin: "manual" | "auto",
  roomName: string,
  preOfflineCloudMarkdown: string | null = null,
): Promise<CollabCacheEntry> {
  if (entry.offlineOrigin) {
    // Already offline; just refresh the status so the badge re-paints.
    collabStatusStore.getState().setEditingOffline(noteId, entry.offlineOrigin);
    return entry;
  }
  // Disconnect the WS so the provider stops retrying and competing
  // with local edits for the ydoc.
  try {
    entry.provider.disconnect();
  } catch {
    // ignore — disconnect is best-effort during the auto-fallback path
  }
  // Reuse the warm persistence from a previous offline session instead
  // of attaching a second IndexeddbPersistence to the same Y.Doc.
  if (!entry.persistence) {
    const { persistence } = attachPersistence(entry.ydoc, roomName);
    entry.persistence = persistence;
  }
  entry.offlineOrigin = origin;
  entry.preOfflineCloudMarkdown = preOfflineCloudMarkdown;
  // Edits from this point on are local-only until we reconnect. Attach
  // the marker once per Y.Doc; the handler no-ops while online.
  if (!editListenersAttached.has(entry.ydoc)) {
    editListenersAttached.add(entry.ydoc);
    entry.ydoc.on("afterTransaction", () => markLocalEdits(entry));
  }
  collabStatusStore.getState().setEditingOffline(noteId, origin);
  return entry;
}

/**
 * Leave offline mode. We deliberately keep `persistence` attached as
 * a warm cache so the next session can rehydrate without hitting the
 * network; the cost is one observer on `afterTransaction` that writes
 * updates to IndexedDB, which is negligible. If the user later
 * reconnects with a conflict, the caller (reconnect path) decides
 * what to do with the local edits; the persistence stays put.
 */
export function exitOfflineMode(noteId: string, entry: CollabCacheEntry): void {
  if (!entry.offlineOrigin) return;
  entry.offlineOrigin = null;
  collabStatusStore.getState().setStatus(noteId, "connecting");
}
