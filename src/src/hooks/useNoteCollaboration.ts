import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { useAuthStore } from "../zustand/useAuthStore";
import { HOCUSPOCUS_WS_URL } from "../statics";
import { useAccessToken } from "../api/queries/useAccessToken";
import { queryClient } from "../api/queryClient";

type CollabCacheEntry = {
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  persistence: IndexeddbPersistence;
};

/**
 * Custom hook to manage real-time collaboration for a specific note.
 *
 * This hook initializes and manages the lifecycle of a Y.js document (`Y.Doc`)
 * and a Hocuspocus provider for real-time synchronization. It also sets up
 * IndexedDB persistence for offline support.
 *
 * The connection is established only when both a `noteId` and an `accessToken` are available.
 * When the `noteId` or `accessToken` changes, the existing connection is torn down
 * and a new one is established.
 *
 * @param noteId - The unique identifier for the note to collaborate on. If undefined,
 * no connection will be established.
 * @returns An object containing the Y.js document (`ydoc`) and the Hocuspocus
 * provider instance (`provider`). Both will be `null` until the connection is initialized.
 *
 * @example
 * ```tsx
 * const MyEditor = ({ noteId }) => {
 *   const { ydoc, provider } = useNoteCollaboration(noteId);
 *
 *   if (!ydoc || !provider) {
 *     return <div>Loading...</div>;
 *   }
 *
 *   return <Editor ydoc={ydoc} provider={provider} />;
 * }
 * ```
 */
export function useNoteCollaboration(noteId?: string): CollabCacheEntry | null {
  // cache to not rebuild ydoc / provider and hence prevent editor rebuilds
  const collabCache = useRef<Map<string, CollabCacheEntry>>(new Map());

  const { data: accessToken } = useAccessToken();

  const [state, setEntry] = useState<CollabCacheEntry | null>(null);

  // when useAuthStore gets a new token from the query, then the subscriber will
  // trigger a reconnect. I don't know if this actually reconnects, if the
  // connection is already established, since query updates at 14 of 15 minutes valid token time
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe((state, prevState) => {
      if (state.accessToken !== prevState.accessToken) {
        collabCache.current.forEach(({ provider }) => {
          provider.connect();
        });
      }
    });

    return unsubscribe;
  });

  useEffect(() => {
    if (!noteId || !accessToken) {
      console.log(
        "Don't connect to Hocuspocus provider, missing noteId or accessToken",
      );
      return;
    }
    let cached = collabCache.current.get(noteId);

    if (!cached) {
      console.log("Creating new Hocuspocus provider for note", noteId);
      const ydoc = new Y.Doc();
      // this also loads the document from IndexedDB into ydoc
      const persistence = new IndexeddbPersistence(`note-${noteId}`, ydoc);
      const provider = new HocuspocusProvider({
        url: `${HOCUSPOCUS_WS_URL}`,
        document: ydoc,
        name: `note-${noteId}`,
        token: () => useAuthStore.getState().accessToken ?? "",
      });

      cached = { ydoc, provider, persistence };
      collabCache.current.set(noteId, cached);
    } else {
      console.debug("Using cached Hocuspocus provider for note", noteId);
      cached.provider.connect();
    }

    setEntry(cached);

    // if current accessToken still causes issues, listening for status might help
    // cached.provider.on("status", () => {
    //   console.log("Hocuspocus provider status changed");
    // });

    return () => {
      cached!.provider.disconnect();
    };
  }, [noteId]);

  if (!noteId) {
    // if no noteId is provided, return null values
    return null;
  }
  return state;
}
