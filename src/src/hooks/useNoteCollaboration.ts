import { useMemo } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";

/**
 * Hook for managing real-time collaboration on notes using Yjs and Hocuspocus.
 *
 * Sets up a Yjs document with IndexedDB persistence and connects to a Hocuspocus
 * WebSocket provider for real-time synchronization of note changes across clients.
 *
 * @param noteId - The unique identifier of the note. If not provided, the hook returns null.
 * @returns An object containing the Yjs document and Hocuspocus provider for collaboration,
 *          or null if no noteId is provided.
 * @returns.ydoc - The Yjs document instance for collaborative editing.
 * @returns.provider - The Hocuspocus provider for WebSocket synchronization.
 *
 * @example
 * ```typescript
 * const collaboration = useNoteCollaboration("note-123");
 * if (collaboration) {
 *   const { ydoc, provider } = collaboration;
 *   // Use ydoc and provider for collaboration
 * }
 * ```
 */
export function useNoteCollaboration(noteId?: string) {
  return useMemo(() => {
    if (!noteId) return { ydoc: null, provider: null };

    const ydoc = new Y.Doc();

    new IndexeddbPersistence(`note-${noteId}`, ydoc);
    const provider = new HocuspocusProvider({
      url: "ws://localhost:8666",
      name: noteId,
      document: ydoc,
    });

    return {
      ydoc,
      provider,
    };
  }, [noteId]);
}
