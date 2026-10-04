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
  type CollabCacheEntry,
} from "./collabCache";

type PublicCollabCacheEntry = CollabCacheEntry;
const WS_OFFLINE_GRACE_MS = 5_000;
const publicCollabCache = createCollabCache<PublicCollabCacheEntry>();

export function usePublicNoteCollaboration(
  noteId?: string,
): PublicCollabCacheEntry | null {
  const shareAccessToken = useAuthStore((s) => s.shareAccessToken);

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
        publicCollabCache.forEach((entry) => entry.provider.connect());
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
      if (cached.offlineOrigin) return;
      cached.provider.connect();
      attachPublicWsFailureWatchers(noteId, cached);
      return;
    }

    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: HOCUSPOCUS_WS_URL,
      document: ydoc,
      name: `note-${noteId}`,
      // Read fresh on every handshake so the share JWT rotation lands
      // without us having to recreate the provider.
      token: () => useAuthStore.getState().shareAccessToken ?? "",
    });
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
    attachPublicWsFailureWatchers(noteId, entry);
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
 * ydoc + provider are rebuilt from scratch; IndexedDB is cleared;
 * the next mount of `usePublicNoteCollaboration(noteId)` sees a
 * fresh entry. The Hocuspocus provider is created here so the call
 * site does not need to know which flow it is in.
 */
export async function rehydratePublicCollabSession(
  noteId: string,
  _seedMarkdown?: string,
): Promise<void> {
  void _seedMarkdown;
  const existing = publicCollabCache.get(noteId);
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
  const provider = new HocuspocusProvider({
    url: HOCUSPOCUS_WS_URL,
    document: ydoc,
    name: `note-${noteId}`,
    token: () => useAuthStore.getState().shareAccessToken ?? "",
  });
  publicCollabCache.set(noteId, {
    ydoc,
    provider,
    persistence: null,
    hasUnsyncedLocalEdits: false,
    offlineOrigin: null,
    lastLocalEditAt: null,
    preOfflineCloudMarkdown: null,
  });
  attachPublicWsFailureWatchers(noteId, publicCollabCache.get(noteId)!);
}
