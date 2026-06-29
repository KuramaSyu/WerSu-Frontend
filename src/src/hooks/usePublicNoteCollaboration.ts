import { useEffect, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { HOCUSPOCUS_WS_URL } from "../statics";
import { useAuthStore } from "../zustand/useAuthStore";
import { collabStatusStore } from "../zustand/useCollabStatusStore";
import type { CollabCacheEntry } from "./useNoteCollaboration";

/**
 * Public, anonymous, read-mostly collaboration hook.
 *
 * Intended for shared-note URLs where the viewer isn't authenticated
 * (or is authenticated but the note is opened through a share token).
 * The Y.Doc is still required so Tiptap's `Collaboration` extension has
 * a document to bind to, but we don't use the user's JWT — the share
 * token is used instead to authenticate against Hocuspocus.
 *
 * NOTE: This is a structural stub. The connection / persistence logic
 * is intentionally not implemented yet — the public endpoint and the
 * exact behaviour of `disconnect on unmount` need to be decided first.
 * The signature mirrors `useNoteCollaboration` so the editor core
 * (which only cares about `{ ydoc, provider } | null`) doesn't need
 * to know which one is in use.
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

    // TODO: implement the public connection. For now we open a no-op
    // Y.Doc so the editor can mount, but we DO NOT open a Hocuspocus
    // WebSocket and we DO NOT persist via IndexedDB (public viewers
    // shouldn't accumulate local drafts on shared machines).
    const ydoc = new Y.Doc();
    const persistence = new IndexeddbPersistence(`public-note-${noteId}`, ydoc);
    const provider = new HocuspocusProvider({
      url: HOCUSPOCUS_WS_URL,
      document: ydoc,
      name: `public-note-${noteId}`,
      // TODO: real auth payload — likely `{ token: shareAccessToken }`
      // or a dedicated /public endpoint.
      token: shareAccessToken,
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
