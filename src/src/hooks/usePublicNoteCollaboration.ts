// ---------------------------------------------------------------------------
// usePublicNoteCollaboration
// Public, anonymous collaboration hook. Mirror of
// `useNoteCollaboration` for shared-note URLs. IndexedDB persistence
// is deferred — see the offline-mode design in `useNoteCollaboration.ts`.
// ---------------------------------------------------------------------------

import { useEffect, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { HOCUSPOCUS_WS_URL } from "../statics";
import { useAuthStore } from "../zustand/useAuthStore";
import { collabStatusStore } from "../zustand/useCollabStatusStore";
import {
  createCollabCache,
  enterOfflineMode,
  exitOfflineMode,
  guardWebsocketReconnects,
  type CollabCacheEntry,
} from "./collabCache";
import {
  fragmentLength,
  instrumentCollabSession,
  logCollabContent,
} from "./collabContentLog";

type PublicCollabCacheEntry = CollabCacheEntry;
// Mirror of the private hook: one connection attempt, then offline.
const WS_MAX_ATTEMPTS = 1;
const WS_OFFLINE_GRACE_MS = 5_000;
const publicCollabCache = createCollabCache<PublicCollabCacheEntry>();

export function usePublicNoteCollaboration(
  noteId?: string,
): PublicCollabCacheEntry | null {
  const shareAccessToken = useAuthStore((s) => s.shareAccessToken);

  // what is this?
  const entry = useSyncExternalStore(
    (onChange) => publicCollabCache.subscribe(onChange),
    () => (noteId ? (publicCollabCache.get(noteId) ?? null) : null),
    () => null,
  );

  // Reconnect cached providers when the share JWT rotates so the
  // refresh (driven by `online_until`) lands on the open socket.
  useEffect(() => {
    return useAuthStore.subscribe((s, prev) => {
      if (s.shareAccessToken !== prev.shareAccessToken) {
        publicCollabCache.forEach((entry) => {
          // Offline entries must stay offline; reconnecting them here
          // would race the user's explicit choice.
          if (!entry.offlineOrigin) entry.provider.connect();
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!noteId) return;
    if (!shareAccessToken) {
      collabStatusStore
        .getState()
        .setStatus(
          noteId,
          "awaitingToken",
          "Waiting for the share token to load…",
        );
      return;
    }

    if (publicCollabCache.has(noteId)) {
      const cached = publicCollabCache.get(noteId)!;
      instrumentCollabSession(noteId, cached.ydoc, cached.provider);
      logCollabContent("provider-reuse(public)", noteId, {
        fragmentLen: fragmentLength(cached.ydoc),
        providerSynced: cached.provider.synced ?? null,
        offlineOrigin: cached.offlineOrigin,
      });
      if (cached.offlineOrigin) return;
      // Install the guard before connecting so the first failure is
      // caught and routed into the offline fallback.
      attachPublicWsFailureWatchers(noteId, cached);
      cached.provider.connect();
      return;
    }

    const ydoc = new Y.Doc();
    // `autoConnect` / `maxAttempts` are forwarded to the internal
    // HocuspocusProviderWebsocket. The upstream config type omits them
    // when `url` is passed, so assign to a variable first.
    const providerConfig = {
      url: HOCUSPOCUS_WS_URL,
      document: ydoc,
      name: `note-${noteId}`,
      // We drive the connection ourselves (after installing the
      // reconnect guard) and cap retries so a blocked socket fails
      // fast into offline mode instead of looping forever.
      autoConnect: false,
      maxAttempts: WS_MAX_ATTEMPTS,
      // Read fresh on every handshake so the share JWT rotation lands
      // without us having to recreate the provider.
      token: () => useAuthStore.getState().shareAccessToken ?? "",
    };
    const provider = new HocuspocusProvider(providerConfig);
    const entry: PublicCollabCacheEntry = {
      ydoc,
      provider,
      persistence: null,
      hasUnsyncedLocalEdits: false,
      offlineOrigin: null,
      lastLocalEditAt: null,
      preOfflineCloudMarkdown: null,
    };
    publicCollabCache.set(noteId, entry);
    logCollabContent("provider-create(public)", noteId, {
      fragmentLen: fragmentLength(ydoc),
      providerSynced: provider.synced ?? null,
    });
    instrumentCollabSession(noteId, ydoc, provider);
    attachPublicWsFailureWatchers(noteId, entry);
    entry.provider.connect();
  }, [noteId, shareAccessToken]);

  return entry;
}

/** Cache lookup without subscribing — kept for parity with the private hook. */
export function getPublicCollabEntry(
  noteId: string,
): PublicCollabCacheEntry | undefined {
  return publicCollabCache.get(noteId);
}

function attachPublicWsFailureWatchers(
  noteId: string,
  entry: PublicCollabCacheEntry,
): void {
  const ws = (
    entry.provider as unknown as {
      configuration: {
        websocketProvider: {
          on: (event: string, h: (...args: unknown[]) => void) => void;
          off: (event: string, h: (...args: unknown[]) => void) => void;
          status: string;
        };
      };
    }
  ).configuration.websocketProvider;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;
  const clearGrace = () => {
    if (graceTimer) {
      clearTimeout(graceTimer);
      graceTimer = null;
    }
  };
  const onMaxAttemptsFailed = () => {
    clearGrace();
    void goPublicOffline(noteId, "auto");
  };
  const onDisconnect = () => {
    clearGrace();
    graceTimer = setTimeout(() => {
      if (ws.status === "disconnected") {
        void goPublicOffline(noteId, "auto");
      }
    }, WS_OFFLINE_GRACE_MS);
  };
  const onOpen = () => clearGrace();
  const onConnect = () => clearGrace();
  ws.on("maxAttemptsFailed", onMaxAttemptsFailed);
  ws.on("disconnect", onDisconnect);
  ws.on("open", onOpen);
  ws.on("connect", onConnect);
  // Catch exhausted `connect()` promises and make every future
  // reconnect a no-op while offline.
  guardWebsocketReconnects(noteId, entry, (id) => {
    void goPublicOffline(id, "auto");
  });
}

export async function goPublicOffline(
  noteId: string,
  origin: "manual" | "auto",
  preOfflineCloudMarkdown: string | null = null,
): Promise<void> {
  const entry = publicCollabCache.get(noteId);
  if (!entry) return;
  if (entry.offlineOrigin) {
    collabStatusStore.getState().setEditingOffline(noteId, entry.offlineOrigin);
    return;
  }
  await enterOfflineMode(
    noteId,
    entry,
    origin,
    `public-note-${noteId}`,
    preOfflineCloudMarkdown,
  );
}

export function goPublicOnline(noteId: string): void {
  const entry = publicCollabCache.get(noteId);
  if (!entry) return;
  exitOfflineMode(noteId, entry);
  try {
    entry.provider.connect();
  } catch {
    // ignore
  }
}

/**
 * Mirror of `rehydrateCollabSession` for public-note restores. The
 * ydoc + provider are rebuilt from scratch, and the server supplies
 * the shared Y.Doc state during synchronization.
 */
export async function rehydratePublicCollabSession(
  noteId: string,
): Promise<void> {
  const existing = publicCollabCache.get(noteId);
  logCollabContent("rehydrate(public)", noteId, {
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
  const ydoc = new Y.Doc();
  const providerConfig = {
    url: HOCUSPOCUS_WS_URL,
    document: ydoc,
    name: `note-${noteId}`,
    autoConnect: false,
    maxAttempts: WS_MAX_ATTEMPTS,
    token: () => useAuthStore.getState().shareAccessToken ?? "",
  };
  const provider = new HocuspocusProvider(providerConfig);
  publicCollabCache.set(noteId, {
    ydoc,
    provider,
    persistence: null,
    hasUnsyncedLocalEdits: false,
    offlineOrigin: null,
    lastLocalEditAt: null,
    preOfflineCloudMarkdown: null,
  });
  instrumentCollabSession(noteId, ydoc, provider);
  attachPublicWsFailureWatchers(noteId, publicCollabCache.get(noteId)!);
  provider.connect();
}
