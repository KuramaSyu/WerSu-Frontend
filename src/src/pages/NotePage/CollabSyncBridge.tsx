// ---------------------------------------------------------------------------
// CollabSyncBridge
// Owns provider.on("synced", ...) and the seeding of the Y.Doc.
//
// The Y.Doc is the live state of a note: in write mode it can be
// ahead of the last save (someone typed, nobody hit save). The saved
// markdown must therefore never be written into a doc that already
// holds live content - that resets the live doc to the last saved
// version every time the editor mounts. The saved markdown only
// seeds a doc the server has no state for.
//
// Reads the markdown from the active-note store (not a prop) so a
// fresh Tanstack Note ref does not break the memoized bridge. Lives
// outside the editor body so a per-keystroke transaction does not
// re-subscribe.
// ---------------------------------------------------------------------------

import { memo, useCallback, useEffect, useRef } from "react";
import * as Y from "yjs";
import type { Editor } from "@tiptap/core";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { markdownToProsemirror } from "../../utils/converters/toProsemirror/markdownToProsemirror";
import { logRerender } from "./editorRenderLog";

export interface CollabSyncBridgeProps {
  editor: Editor | null;
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  editMode: boolean;
  noteId: string | undefined;
}

/** Per-doc bookkeeping for the seed decision. */
interface SeedState {
  doc: Y.Doc | null;
  /**
   * The server handed us content for this doc at some point. An empty
   * doc after that means the user cleared it on purpose, so it must
   * not be re-seeded with the saved markdown.
   */
  serverHasContent: boolean;
}

const CollabSyncBridgeImpl: React.FC<CollabSyncBridgeProps> = ({
  editor,
  ydoc,
  provider,
  editMode,
  noteId,
}) => {
  logRerender("CollabSyncBridge", {
    hasEditor: !!editor,
    hasProvider: !!provider,
    editMode,
  });

  // The markdown the editor knows about. Re-read on every render so
  // the seed below always uses the freshest text - the note may land
  // after the first sync.
  const sourceMarkdown = useActiveNoteStore((s) => s.sourceMarkdown);

  const seedStateRef = useRef<SeedState>({
    doc: null,
    serverHasContent: false,
  });

  const seedEmptyDoc = useCallback(() => {
    if (!editor || !ydoc) return;
    if (seedStateRef.current.doc !== ydoc) {
      // A different doc: the bookkeeping does not carry over.
      seedStateRef.current = { doc: ydoc, serverHasContent: false };
    }
    const fragment = ydoc.getXmlFragment("default");
    if (fragment.length > 0) {
      // Live content (server state or an earlier seed) owns the doc.
      seedStateRef.current.serverHasContent = true;
      return;
    }
    if (seedStateRef.current.serverHasContent) return;
    const store = useActiveNoteStore.getState();
    // The source buffer carries the markdown we know about: the note's
    // saved content, or a pending version restore.
    const markdown = store.sourceMarkdown || store.getContent();
    if (!markdown) return;
    // Write into the doc directly. The store's `setContent` cannot be
    // used here: it dedupes against the last written markdown, and
    // the source buffer already claimed that value.
    try {
      const doc = markdownToProsemirror(editor, markdown);
      prosemirrorJSONToYXmlFragment(editor.schema, doc, fragment);
    } catch (err) {
      console.warn("[collab-sync] seeding the Y.Doc failed", err);
      return;
    }
    store.setSourceMarkdown(markdown);
    // Only remember the seed once it landed, so a later sync retries.
    if (fragment.length > 0) {
      seedStateRef.current.serverHasContent = true;
    }
  }, [editor, ydoc]);

  useEffect(() => {
    if (!editor || !ydoc || !provider) return;

    if (!editMode) {
      provider.disconnect();
      return;
    }

    const onSynced = () => {
      seedEmptyDoc();
    };

    provider.on("synced", onSynced);
    // The handshake may have completed before this bridge subscribed.
    if (provider.synced) {
      onSynced();
    }
    return () => {
      provider.off("synced", onSynced);
    };
  }, [editor, provider, editMode, ydoc, noteId, seedEmptyDoc]);

  // The note markdown can arrive after the first sync. Re-check then:
  // the doc is still empty and the server had no state for it, so it
  // can be seeded now.
  useEffect(() => {
    if (!provider?.synced) return;
    seedEmptyDoc();
  }, [provider, sourceMarkdown, seedEmptyDoc]);

  return null;
};

/** Memoized so the parent re-render does not re-attach the synced subscription per keystroke. */
export const CollabSyncBridge = memo(CollabSyncBridgeImpl);
