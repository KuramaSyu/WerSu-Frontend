// ---------------------------------------------------------------------------
// CollabSyncBridge
// Owns provider.on("synced", ...) that loads note markdown into the
// Y.Doc when the WebSocket reconnects. Reads from getContent() so a
// fresh Tanstack Note ref does not break the memoized bridge. Lives
// outside the editor body so a per-keystroke transaction does not
// re-subscribe.
// ---------------------------------------------------------------------------

import { memo, useEffect } from "react";
import * as Y from "yjs";
import type { Editor } from "@tiptap/core";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { logRerender } from "./editorRenderLog";

export interface CollabSyncBridgeProps {
  editor: Editor | null;
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  editMode: boolean;
  noteId: string | undefined;
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
  useEffect(() => {
    if (!editor || !ydoc || !provider) return;

    if (!editMode) {
      provider.disconnect();
      return;
    }

    const onSynced = () => {
      const isEmpty = ydoc.getXmlFragment("default").length === 0;
      if (!isEmpty) return;
      // Pull markdown from the store. getContent() returns source
      // markdown in source mode, editor markdown in rich mode. Reading
      // from the store (not a prop) means a fresh Tanstack Note ref
      // does not break the bridge.
      const content = useActiveNoteStore.getState().getContent();
      if (!content) return;
      useActiveNoteStore.getState().setContent(content);
    };

    provider.on("synced", onSynced);
    return () => {
      provider.off("synced", onSynced);
    };
  }, [editor, provider, editMode, ydoc, noteId]);

  return null;
};

/** Memoized so the parent re-render does not re-attach the synced subscription per keystroke. */
export const CollabSyncBridge = memo(CollabSyncBridgeImpl);
