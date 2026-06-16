import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { useAuthStore } from "../zustand/useAuthStore";
import { HOCUSPOCUS_WS_URL } from "../statics";
import { useAccessToken } from "../api/queries/useAccessToken";

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
export function useNoteCollaboration(noteId?: string) {
  const { data: accessToken } = useAccessToken();

  console.log("Initializing collaboration for note:", noteId);

  const [state, setState] = useState({
    ydoc: null as Y.Doc | null,
    provider: null as HocuspocusProvider | null,
  });

  useEffect(() => {
    if (!noteId || !accessToken) {
      console.log(
        "Don't connect to Hocuspocus provider, missing noteId or accessToken",
      );
      return;
    }

    const ydoc = new Y.Doc();

    // this also loads the document from IndexedDB into ydoc
    const persistence = new IndexeddbPersistence(`note-${noteId}`, ydoc);

    console.log(
      `Setup Hocuspocus provider for note ${noteId} with access token: ${accessToken.substring(0, 10)}... to ${HOCUSPOCUS_WS_URL}`,
    );
    const provider = new HocuspocusProvider({
      url: `${HOCUSPOCUS_WS_URL}`,
      name: `note-${noteId}`,
      document: ydoc,
      token: accessToken,
    });

    setState({ ydoc, provider });

    provider.on("status", () => {
      console.log("Hocuspocus provider status changed");
    });

    // when accessToken or note changes, disconnect the provider
    return () => {
      provider.disconnect();
      ydoc.destroy();
    };
  }, [noteId, accessToken]);

  if (!noteId) {
    // if no noteId is provided, return null values
    return { ydoc: null, provider: null };
  }
  return state;
}
