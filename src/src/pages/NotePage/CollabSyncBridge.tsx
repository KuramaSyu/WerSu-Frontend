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
// "The server has state" is tracked from the provider's remote
// transactions (see hasServerContent), not from whether we seeded the
// doc ourselves. That distinction lets an empty doc created by a
// server-side deletion stay empty across reconnects, while a brand-new
// room with no server state at all still receives the saved markdown.
//
// Reads the markdown from the active-note store (not a prop) so a
// fresh Tanstack Note ref does not break the memoized bridge. Lives
// outside the editor body so a per-keystroke transaction does not
// re-subscribe.
// ---------------------------------------------------------------------------

import { memo, useCallback, useEffect } from "react";
import * as Y from "yjs";
import type { Editor } from "@tiptap/core";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { markdownToProsemirror } from "../../utils/converters/toProsemirror/markdownToProsemirror";
import {
  fragmentHasContent,
  fragmentLength,
  fragmentText,
  hasServerContent,
  logCollabContent,
  logContentSet,
} from "../../hooks/collabContentLog";
import { logRerender } from "./editorRenderLog";

/** Docs where we have seen or written meaningful content locally. */
const docsWithLocalContent = new WeakSet<Y.Doc>();

export interface CollabSyncBridgeProps {
  editor: Editor | null;
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  editMode: boolean;
  noteId: string | undefined;
}

// Disconnects the collab provider on edit->read, and seeds the shared
// doc from the saved markdown only when the server has no state for it.
const CollabSyncBridgeImpl: React.FC<CollabSyncBridgeProps> = ({
  editor,
  ydoc,
  provider,
  editMode,
  noteId,
}) => {
  logRerender("CollabSyncBridge", {
    hasEditor: !!editor,
    hasYdoc: !!ydoc,
    hasProvider: !!provider,
    editMode,
  });

  // The markdown the editor knows about. Re-read on every render so
  // the seed below always uses the freshest text - the note may land
  // after the first sync.
  const sourceMarkdown = useActiveNoteStore((s) => s.sourceMarkdown);

  const seedEmptyDoc = useCallback(() => {
    if (!editor || !ydoc) {
      logCollabContent("seed-skip(no-editor-or-ydoc)", noteId, {
        hasEditor: !!editor,
        hasYdoc: !!ydoc,
      });
      return;
    }
    const fragment = ydoc.getXmlFragment("default");
    if (fragmentHasContent(ydoc)) {
      docsWithLocalContent.add(ydoc);
      logCollabContent("seed-skip(local-content)", noteId, {
        fragmentLen: fragment.length,
        fragmentHead: fragmentText(ydoc).slice(0, 200),
      });
      return;
    }
    // A remote transaction with real content means the room already
    // exists on the server. An empty fragment after that is an
    // intentional deletion, not a missing document. An empty paragraph
    // left behind by an earlier failed write does not count.
    if (hasServerContent(ydoc)) {
      logCollabContent("seed-skip(server-content)", noteId, {
        fragmentLen: fragment.length,
        fragmentHead: fragmentText(ydoc).slice(0, 200),
      });
      return;
    }
    // We already seeded or observed real content in this doc. Do not
    // resurrect the saved markdown after a local delete.
    if (docsWithLocalContent.has(ydoc)) {
      logCollabContent("seed-skip(seed-owned)", noteId, {
        fragmentLen: fragment.length,
        fragmentHead: fragmentText(ydoc).slice(0, 200),
      });
      return;
    }
    logCollabContent("seed-check", noteId, {
      fragmentLen: fragment.length,
      fragmentHead: fragmentText(ydoc).slice(0, 200),
      sourceMarkdownLen: useActiveNoteStore.getState().sourceMarkdown.length,
    });
    const store = useActiveNoteStore.getState();
    // The source buffer carries the markdown we know about: the note's
    // saved content, or a pending version restore.
    const markdown = store.sourceMarkdown || store.getContent();
    if (!markdown) {
      logCollabContent("seed-skip(no-markdown)", noteId, {
        sourceMarkdownLen: store.sourceMarkdown.length,
        editorMarkdownLen: store.getContent().length,
      });
      return;
    }
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
    docsWithLocalContent.add(ydoc);
    logContentSet(noteId, markdown, ydoc, "ydoc-fragment");
    logCollabContent("seed", noteId, {
      markdownLen: markdown.length,
      fragmentLen: fragmentLength(ydoc),
      fragmentHead: fragmentText(ydoc).slice(0, 200),
    });
  }, [editor, ydoc, noteId]);

  useEffect(() => {
    if (!provider) return;

    if (!editMode) {
      logCollabContent("read-mode-disconnect", noteId, {
        providerSynced: provider.synced ?? null,
        fragmentLen: fragmentLength(ydoc),
        fragmentHead: fragmentText(ydoc).slice(0, 200),
      });
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
  }, [provider, editMode, noteId, ydoc, seedEmptyDoc]);

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
