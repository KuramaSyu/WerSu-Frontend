import { useEffect, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { useAuthStore } from "../zustand/useAuthStore";
import { HOCUSPOCUS_WS_URL } from "../statics";
import { useAccessToken } from "../api/queries/useAccessToken";
import { collabStatusStore } from "../zustand/useCollabStatusStore";

type CollabCacheEntry = {
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  persistence: IndexeddbPersistence;
};

/**
 * Module-scope cache, keyed by `noteId`. Module-scope (not `useRef`) so
 * that two trees subscribing to the same note — `Editor.tsx` and
 * `CollabStatusBadge.tsx` — share a single `Y.Doc` + provider instead of
 * each opening their own WebSocket.
 */
const collabCache = new Map<string, CollabCacheEntry>();
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

/**
 * Real-time collab hook. Provider creation is gated on a JWT being in
 * `useAuthStore.accessToken` — opening the WebSocket without a token
 * would make Hocuspocus reply with `jwt must be provided` and retry in
 * a tight loop.
 *
 * Entries are kept for the module lifetime — the editor and badge both
 * re-mount frequently (read/write toggle, etc.) and we don't want to
 * drop the IndexedDB-loaded `Y.Doc` and lose local edits.
 */
export function useNoteCollaboration(noteId?: string): CollabCacheEntry | null {
  const tokenQuery = useAccessToken();
  const accessToken = useAuthStore((s) => s.accessToken);

  const entry = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => (noteId ? (collabCache.get(noteId) ?? null) : null),
    () => null,
  );

  // Reconnect every provider when the access token rotates (14-min
  // refresh, logout, share-token swap).
  useEffect(() => {
    return useAuthStore.subscribe((s, prev) => {
      if (s.accessToken !== prev.accessToken) {
        collabCache.forEach(({ provider }) => provider.connect());
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
      collabCache.get(noteId)!.provider.connect();
      return;
    }

    console.log("Creating new Hocuspocus provider for note", noteId);
    const ydoc = new Y.Doc();
    const persistence = new IndexeddbPersistence(`note-${noteId}`, ydoc);
    const provider = new HocuspocusProvider({
      url: `${HOCUSPOCUS_WS_URL}`,
      document: ydoc,
      name: `note-${noteId}`,
      // Read fresh on every handshake so 14-min token rotations land.
      token: () => useAuthStore.getState().accessToken ?? "",
    });
    collabCache.set(noteId, { ydoc, provider, persistence });
    emit();
  }, [noteId, accessToken]);

  // Mirror JWT-fetch failures into the status store for the badge tooltip.
  useEffect(() => {
    if (noteId && tokenQuery.isError) {
      collabStatusStore.getState().setTokenFetchError(noteId, tokenQuery.error);
    }
  }, [noteId, tokenQuery.isError, tokenQuery.error]);

  return entry;
}

/** Cache lookup without subscribing — used by the badge's retry button. */
export function getCollabEntry(noteId: string): CollabCacheEntry | undefined {
  return collabCache.get(noteId);
}
