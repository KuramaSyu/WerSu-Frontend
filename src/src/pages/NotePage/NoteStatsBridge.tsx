// NoteStatsBridge
// Mirrors word / letter / row counts over `editor.state.doc.textContent`
// into `useNoteStatsStore`. Pushes stats whenever the editor doc changes,
// regardless of how the change got there:
//   - Local edits fire `editor.on("transaction")` with `docChanged: true`.
//   - The seed path in `setContent` writes the Y.Doc XmlFragment
//     directly via `prosemirrorJSONToYXmlFragment`, bypassing ProseMirror
//     transactions entirely. The Collaboration extension then mirrors
//     that change into `editor.state.doc` on its own observer, so we
//     also subscribe to the ydoc's XmlFragment `observeDeep` event.
// Renders nothing.

import { memo, useEffect } from "react";
import type { Editor } from "@tiptap/core";
import * as Y from "yjs";
import { useNoteStatsStore } from "../../zustand/noteStatsStore";
import { computeStats } from "../../utils/noteStats";
import { logRerender } from "./editorRenderLog";

export interface NoteStatsBridgeProps {
  editor: Editor | null;
  ydoc?: Y.Doc | null;
}

const NoteStatsBridgeImpl: React.FC<NoteStatsBridgeProps> = ({
  editor,
  ydoc,
}) => {
  logRerender("NoteStatsBridge", { hasEditor: !!editor, hasYdoc: !!ydoc });

  useEffect(() => {
    if (!editor) return;

    const push = () => {
      useNoteStatsStore
        .getState()
        .setStats(computeStats(editor.state.doc.textContent));
    };

    const onTransaction = ({
      transaction,
    }: {
      transaction: { docChanged: boolean };
    }) => {
      if (!transaction.docChanged) return;
      push();
    };

    editor.on("transaction", onTransaction);

    // The ydoc XmlFragment is the source of truth in collab mode. Writes
    // from `setContent` mutate it directly, so the corresponding local
    // doc change does not go through `editor.on("transaction")` with
    // `docChanged: true`. `observeDeep` catches every nested mutation
    // and lets us recompute on the next tick, after the Collaboration
    // extension has mirrored the change into `editor.state.doc`.
    let observer: ((events: Y.YEvent<Y.AbstractType<unknown>>[]) => void) | null =
      null;
    let detachTimer: number | null = null;
    if (ydoc) {
      const fragment = ydoc.getXmlFragment("default");
      observer = () => {
        // Defer to the next frame so the Collaboration extension has
        // already pushed the new XmlFragment into editor.state.doc by
        // the time push() runs.
        if (detachTimer !== null) {
          window.clearTimeout(detachTimer);
        }
        detachTimer = window.setTimeout(push, 0);
      };
      fragment.observeDeep(observer);
    }

    push();

    return () => {
      editor.off("transaction", onTransaction);
      if (observer && ydoc) {
        ydoc.getXmlFragment("default").unobserveDeep(observer);
      }
      if (detachTimer !== null) {
        window.clearTimeout(detachTimer);
      }
      useNoteStatsStore.getState().clear();
    };
  }, [editor, ydoc]);

  return null;
};

/** Memoized so a parent re-render does not re-fire the subscriptions. */
export const NoteStatsBridge = memo(NoteStatsBridgeImpl);
