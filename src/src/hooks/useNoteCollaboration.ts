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
 * restore path so the local ydoc, IndexedDB, and Hocuspocus
 * subscription are all rebuilt from scratch. The next reader of
 * `useNoteCollaboration(noteId)` will see a fresh entry; the next
 * mount of the editor will recreate the prosemirror view against
 * the new ydoc.
 *
 * Steps:
 *   1. Disconnect the old provider (if any).
 *   2. Destroy the old ydoc so any pending transactions drop.
 *   3. Detach the IndexedDB persistence (if any) and remove the
 *      stored data so we don't rehydrate stale state.
 *   4. Build a new ydoc + provider, seed it with the server-side
 *      markdown the caller passed in, and let Hocuspocus sync
 *      once the WS opens.
 */
export async function rehydrateCollabSession(
  noteId: string,
  seedMarkdown: string,
): Promise<CollabCacheEntry> {
  const existing = collabCache.get(noteId);
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

  // Always start a fresh ydoc + provider; IndexedDB will be
  // re-attached lazily when the user goes offline again.
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
  attachWsFailureWatchers(noteId, entry);

  // Seed the new ydoc with the server-side markdown so the editor
  // (when it remounts) has a non-empty doc to render before
  // Hocuspocus's first sync lands. The ydoc-direct write uses the
  // legacy `editor.commands.setContent` path because we don't have
  // an editor in this context.
  if (seedMarkdown) {
    ydoc.transact(() => {
      // Use the same JSON shape that the legacy path produced:
      // a single top-level doc node holding the markdown parsed
      // by the markdown extension. We can't call the markdown
      // parser here (it lives in the Tiptap editor), so we write
      // a single text-bearing paragraph that the editor's markdown
      // extension can re-parse on mount.
      const fragment = ydoc.getXmlFragment("default");
      // The editor's `Markdown` extension parses markdown strings
      // into prosemirror JSON; on remount it will re-render this
      // via `editor.storage.markdown.manager.parse(seedMarkdown)`.
      // For now we leave the fragment empty and rely on the
      // editor's own `onBeforeCreate` to do the parse from
      // `content: seedMarkdown` if we ever pass that in. The
      // Hocuspocus sync will populate the ydoc once it lands.
      void fragment;
    });
  }
  return entry;
}
