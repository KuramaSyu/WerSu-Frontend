// ---------------------------------------------------------------------------
// OutlineBridge
// Mirrors the editor's heading outline into useOutlineStore. It only
// pushes on structural heading changes (level, text content, count, or
// presence). Heading slugs are stamped as DOM ids by the HeadingIds
// decoration plugin; this bridge reads that same slug list so the TOC ids
// and the DOM ids can never disagree. Renders nothing.
// ---------------------------------------------------------------------------

import { memo, useEffect } from "react";
import type { Editor } from "@tiptap/core";
import { useOutlineStore } from "../../zustand/outlineStore";
import { headingIdsPluginKey } from "./headingIds";
import { logRerender } from "./editorRenderLog";

export interface OutlineBridgeProps {
  editor: Editor | null;
}

/**
 * How long typing in a heading must pause before the outline store is
 * updated. Rebuilding the tree + re-rendering the panel on every keystroke
 * is what made editing headings feel laggy; a short trailing debounce
 * collapses a burst of edits into one rebuild. The HeadingIds decoration
 * pass (which keeps the DOM ids correct) is cheap and stays per-change.
 */
const PUSH_DEBOUNCE_MS = 450;

/** Stable structural signature for the outline entries. */
const signatureOf = (
  entries: ReadonlyArray<{ level: number; textContent: string }>,
): string => entries.map((entry) => `${entry.level}:${entry.textContent}`).join("|");

const OutlineBridgeImpl: React.FC<OutlineBridgeProps> = ({ editor }) => {
  logRerender("OutlineBridge", { hasEditor: !!editor });
  useEffect(() => {
    if (!editor) return;

    // New editor instance: reset the store and bump the epoch so the
    // TOC can tell this outline apart from the previous one.
    useOutlineStore.getState().beginSession();

    // The HeadingIds plugin owns both the slug list and the DOM ids.
    const entries = () =>
      headingIdsPluginKey.getState(editor.state)?.entries ?? [];
    let prevSig = signatureOf(entries());

    const push = () => {
      const current = entries();
      prevSig = signatureOf(current);
      if (current.length === 0) {
        useOutlineStore.getState().clear();
        return;
      }
      useOutlineStore.getState().setItems(
        current.map((entry) => ({
          id: entry.id,
          level: entry.level,
          textContent: entry.textContent,
        })),
      );
    };

    // Trailing debounce for structural changes. `push` also runs once
    // immediately on bind so the panel is populated without delay.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePush = () => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        push();
      }, PUSH_DEBOUNCE_MS);
    };

    const onTransaction = ({
      transaction,
    }: {
      transaction: { docChanged: boolean };
    }) => {
      // No-doc changes (selection moves, mark refreshes with no range
      // change) can't affect the heading list -> skip the rebuild.
      if (!transaction.docChanged) return;
      // Heading list unchanged -> skip. This is the per-keystroke skip
      // for body typing that used to re-render the panel.
      const nextSig = signatureOf(entries());
      if (nextSig === prevSig) return;
      // The list appearing (document/Y.Doc load) or vanishing (last
      // heading removed) is structural, not a text edit: reflect it
      // immediately so the TOC is not blank while the doc loads.
      if (prevSig === "" || nextSig === "") {
        push();
        return;
      }
      schedulePush();
    };

    editor.on("transaction", onTransaction);
    push();
    return () => {
      editor.off("transaction", onTransaction);
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      useOutlineStore.getState().clear();
    };
  }, [editor]);

  return null;
};

/** Memoized so a parent re-render does not re-fire the transaction subscription. */
export const OutlineBridge = memo(OutlineBridgeImpl);
