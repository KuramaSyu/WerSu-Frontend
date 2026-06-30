import { useEffect, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { HOCUSPOCUS_WS_URL } from "../statics";
import { useAuthStore } from "../zustand/useAuthStore";
import { collabStatusStore } from "../zustand/useCollabStatusStore";
import type { CollabCacheEntry } from "./useNoteCollaboration";

/**
 * Public, anonymous collaboration hook.
 *
 * Mirror of `useNoteCollaboration` for shared-note URLs. The Y.Doc
 * is still required for Tiptap's `Collaboration` extension, but
 * auth uses the share JWT (`useAuthStore.shareAccessToken`) rather
 * than the user's JWT. `token` is a function so JWT rotations land
 * on the handshake without recreating the provider.
 */

type PublicCollabCacheEntry = CollabCacheEntry;

const publicCollabCache = new Map<string, PublicCollabCacheEntry>();
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export function usePublicNoteCollaboration(
  noteId?: string,
): PublicCollabCacheEntry | null {
  const shareAccessToken = useAuthStore((s) => s.shareAccessToken);

  const entry = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => (noteId ? (publicCollabCache.get(noteId) ?? null) : null),
    () => null,
  );

  // Reconnect cached providers when the share JWT rotates so the
  // refresh (driven by `online_until`) lands on the open socket.
  useEffect(() => {
    return useAuthStore.subscribe((s, prev) => {
      if (s.shareAccessToken !== prev.shareAccessToken) {
        publicCollabCache.forEach(({ provider }) => provider.connect());
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
      publicCollabCache.get(noteId)!.provider.connect();
      return;
    }

    const ydoc = new Y.Doc();
    const persistence = new IndexeddbPersistence(`public-note-${noteId}`, ydoc);
    const provider = new HocuspocusProvider({
      url: HOCUSPOCUS_WS_URL,
      document: ydoc,
      name: `public-note-${noteId}`,
      // Read fresh on every handshake so the share JWT rotation lands
      // without us having to recreate the provider.
      token: () => useAuthStore.getState().shareAccessToken ?? "",
    });
    publicCollabCache.set(noteId, { ydoc, provider, persistence });
    emit();
  }, [noteId, shareAccessToken]);

  return entry;
}

/** Cache lookup without subscribing — kept for parity with the private hook. */
export function getPublicCollabEntry(
  noteId: string,
): PublicCollabCacheEntry | undefined {
  return publicCollabCache.get(noteId);
}
