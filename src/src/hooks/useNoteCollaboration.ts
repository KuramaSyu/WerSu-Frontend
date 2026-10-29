// ---------------------------------------------------------------------------
// useNoteCollaboration
// Owns the private-note Hocuspocus session: the Y.Doc the Tiptap
// editor binds to, the WebSocket provider that syncs it, and (lazily)
// the IndexedDB persistence that backs offline mode.
//
// IndexedDB is NOT created up front. It is only attached when:
//   - The user clicks the badge to go offline manually, or
//   - The WebSocket fails (`maxAttemptsFailed` from the inner
//     HocuspocusProviderWebsocket) and we auto-fallback.
// The previous behavior of always creating the persistence caused
// stale-on-disk state to rehydrate into the ydoc before the WS
// handshake completed, which produced visible glitches during
// structural diffs (images, etc.).
// ---------------------------------------------------------------------------

import { useEffect, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useAuthStore } from "../zustand/useAuthStore";
import { HOCUSPOCUS_WS_URL } from "../statics";
import { useAccessToken } from "../api/queries/useAccessToken";
import { collabStatusStore } from "../zustand/useCollabStatusStore";
import {
  createCollabCache,
  enterOfflineMode,
  exitOfflineMode,
  type CollabCacheEntry,
} from "./collabCache";
import {
  fragmentLength,
  instrumentCollabSession,
  logCollabContent,
} from "./collabContentLog";

export type { CollabCacheEntry };

const WS_OFFLINE_GRACE_MS = 5_000;

const collabCache = createCollabCache<CollabCacheEntry>();

export function useNoteCollaboration(noteId?: string): CollabCacheEntry | null {
  const tokenQuery = useAccessToken();
  const accessToken = useAuthStore((s) => s.accessToken);

  const entry = useSyncExternalStore(
    (onChange) => collabCache.subscribe(onChange),
    () => (noteId ? (collabCache.get(noteId) ?? null) : null),
    () => null,
  );

  // Reconnect every provider when the access token rotates (14-min
  // refresh, logout, share-token swap).
  useEffect(() => {
    return useAuthStore.subscribe((s, prev) => {
      if (s.accessToken !== prev.accessToken) {
        collabCache.forEach((entry) => entry.provider.connect());
      }
    });
  }, []);

  useEffect(() => {
    if (!noteId) return;
    if (!accessToken) {
      console.log(
        "Don't connect to Hocuspocus provider, missing accessToken for note",
        noteId,
      );
      collabStatusStore
        .getState()
        .setStatus(
          noteId,
          "awaitingToken",
          "Waiting for the access token to load…",
        );
      return;
    }

    if (collabCache.has(noteId)) {
      console.debug("Re-using cached Hocuspocus provider for note", noteId);
      const cached = collabCache.get(noteId)!;
      instrumentCollabSession(noteId, cached.ydoc, cached.provider);
      logCollabContent("provider-reuse", noteId, {
        fragmentLen: fragmentLength(cached.ydoc),
        providerSynced: cached.provider.synced ?? null,
        offlineOrigin: cached.offlineOrigin,
      });
      if (cached.offlineOrigin) {
        // Stay offline; do not reconnect.
        return;
      }
      cached.provider.connect();
      attachWsFailureWatchers(noteId, cached);
      return;
    }

    console.log("Creating new Hocuspocus provider for note", noteId);
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: `${HOCUSPOCUS_WS_URL}`,
      document: ydoc,
      name: `note-${noteId}`,
      // Read fresh on every handshake so 14-min token rotations land.
      token: () => useAuthStore.getState().accessToken ?? "",
    });
    const entry: CollabCacheEntry = {
      ydoc,
      provider,
      persistence: null,
      hasUnsyncedLocalEdits: false,
      offlineOrigin: null,
      lastLocalEditAt: null,
      preOfflineCloudMarkdown: null,
    };
    collabCache.set(noteId, entry);
    logCollabContent("provider-create", noteId, {
      fragmentLen: fragmentLength(ydoc),
      providerSynced: provider.synced ?? null,
    });
    instrumentCollabSession(noteId, ydoc, provider);
    attachWsFailureWatchers(noteId, entry);
  }, [noteId, accessToken]);

  // Mirror JWT-fetch failures into the status store for the badge tooltip.
  useEffect(() => {
    if (noteId && tokenQuery.isError) {
      collabStatusStore.getState().setTokenFetchError(noteId, tokenQuery.error);
    }
  }, [noteId, tokenQuery.isError, tokenQuery.error]);

  return entry;
}

/**
 * Watch the inner HocuspocusProviderWebsocket for `maxAttemptsFailed`
 * and `disconnect` (no follow-up `open` within the grace window).
 * Either event trips the auto-fallback into offline mode.
 */
function attachWsFailureWatchers(
  noteId: string,
  entry: CollabCacheEntry,
): void {
  const ws = (entry.provider as unknown as {
    configuration: {
      websocketProvider: {
        on: (event: string, h: (...args: unknown[]) => void) => void;
        off: (event: string, h: (...args: unknown[]) => void) => void;
        status: string;
      };
    };
  }).configuration.websocketProvider;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;
  const clearGrace = () => {
    if (graceTimer) {
      clearTimeout(graceTimer);
      graceTimer = null;
    }
  };
  const onMaxAttemptsFailed = () => {
    clearGrace();
    void goOffline(noteId, "auto");
  };
  const onDisconnect = () => {
    clearGrace();
    graceTimer = setTimeout(() => {
      // If we never saw an `open`/reconnect within the grace window,
      // fall back to offline mode. The user can still reconnect
      // manually via the badge.
      if (ws.status === "disconnected") {
        void goOffline(noteId, "auto");
      }
    }, WS_OFFLINE_GRACE_MS);
  };
  const onOpen = () => clearGrace();
  const onConnect = () => clearGrace();
  ws.on("maxAttemptsFailed", onMaxAttemptsFailed);
  ws.on("disconnect", onDisconnect);
  ws.on("open", onOpen);
  ws.on("connect", onConnect);
  // Cleanup on entry teardown is not currently wired (the cache lives
  // for the module lifetime), so we do not register an `off` here.
  // The handlers close over the WS provider that is also module-scoped.
}

/** Cache lookup without subscribing — used by the badge's retry button. */
export function getCollabEntry(noteId: string): CollabCacheEntry | undefined {
  return collabCache.get(noteId);
}

/**
 * Public entry point for "user wants to work offline" (chip click)
 * and "WS is dead, fall back" (auto). Awaits IndexedDB attach so the
 * caller can be sure local edits are durable before showing UI.
 *
 * `preOfflineCloudMarkdown` is the server's view of the note at the
 * moment we go offline. It is the baseline the conflict modal uses
 * to detect concurrent server-side edits when we come back online.
 * Pass `null` if the caller has no clean baseline (e.g. the auto
 * path right after the WS gave up); the conflict modal then treats
 * the reconnect as conflict-free.
 */
export async function goOffline(
  noteId: string,
  origin: "manual" | "auto",
  preOfflineCloudMarkdown: string | null = null,
): Promise<void> {
  const entry = collabCache.get(noteId);
  if (!entry) return;
  if (entry.offlineOrigin) {
    // Already offline; just refresh the status.
    collabStatusStore.getState().setEditingOffline(noteId, entry.offlineOrigin);
    return;
  }
  await enterOfflineMode(
    noteId,
    entry,
    origin,
    `note-${noteId}`,
    preOfflineCloudMarkdown,
  );
}

/**
 * Public entry point for "leave offline mode" (chip click after
 * manual offline, or after the user resolves a conflict). The
 * reconnect-with-diff logic lives in the conflict resolution modal;
 * this just transitions the status and asks the provider to open
 * the socket.
 */
export function goOnline(noteId: string): void {
  const entry = collabCache.get(noteId);
  if (!entry) return;
  exitOfflineMode(noteId, entry);
  try {
    entry.provider.connect();
  } catch {
    // ignore — provider is responsible for its own retry loop
  }
}

/** Resets the local-edit flag after a conflict is resolved. */
export function clearLocalEditsFor(noteId: string): void {
  const entry = collabCache.get(noteId);
  if (!entry) return;
  entry.hasUnsyncedLocalEdits = false;
  entry.lastLocalEditAt = null;
  entry.preOfflineCloudMarkdown = null;
}

/**
 * Full rehydrate of a note's collab session. Used by the version
 * restore path so the provider and Y.Doc are rebuilt from scratch.
 * The server remains the source of truth for the shared Y.Doc.
 */
export async function rehydrateCollabSession(
  noteId: string,
): Promise<CollabCacheEntry> {
  const existing = collabCache.get(noteId);
  logCollabContent("rehydrate", noteId, {
    hadEntry: !!existing,
    fragmentLen: existing ? fragmentLength(existing.ydoc) : -1,
  });
  if (existing) {
    try {
      existing.provider.disconnect();
    } catch {
      // ignore
    }
    if (existing.persistence) {
      try {
        await existing.persistence.destroy();
      } catch {
        // ignore
      }
    }
    try {
      existing.ydoc.destroy();
    } catch {
      // ignore
    }
  }
  // Always start a fresh ydoc + provider and let the server supply
  // the current shared document during synchronization.
  const ydoc = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: `${HOCUSPOCUS_WS_URL}`,
    document: ydoc,
    name: `note-${noteId}`,
    token: () => useAuthStore.getState().accessToken ?? "",
  });
  const entry: CollabCacheEntry = {
    ydoc,
    provider,
    persistence: null,
    hasUnsyncedLocalEdits: false,
    offlineOrigin: null,
    lastLocalEditAt: null,
    preOfflineCloudMarkdown: null,
  };
  collabCache.set(noteId, entry);
  instrumentCollabSession(noteId, ydoc, provider);
  attachWsFailureWatchers(noteId, entry);
  return entry;
}
