import { memo, useEffect } from "react";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { useDraftStore } from "../../zustand/useDraftStore";

export interface DraftTrackerBridgeProps {
  editor: Editor | null;
  noteId?: string;
}

/**
 * Measures the magnitude of a transaction from its step maps:
 * `oldEnd - oldStart` is the deleted size, `newEnd - newStart` the
 * inserted size. Summing both gives a cheap insert+delete "change
 * volume" without serializing the document to markdown.
 */
const measureTransactionChange = (transaction: Transaction): number => {
  let changed = 0;
  transaction.steps.forEach((step) => {
    step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
      changed += oldEnd - oldStart + (newEnd - newStart);
    });
  });
  return changed;
};

/**
 * Marks the active note as a draft whenever the user makes a local edit
 * in the rich editor, accumulating the change volume. Renders nothing.
 *
 * Focus is the discriminator: the note-content seed (`setContent`) and
 * remote collaboration updates both mutate the doc without the editor
 * owning focus, so they are ignored. A real keystroke / toolbar command
 * implies focus.
 *
 * The source-mode editor contributes its own magnitude directly in
 * `NoteEditorCore` and a successful save clears the flag in
 * `editorStore.save`.
 */
const DraftTrackerBridgeImpl: React.FC<DraftTrackerBridgeProps> = ({
  editor,
  noteId,
}) => {
  useEffect(() => {
    if (!editor || !noteId) {
      return;
    }

    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return;
      if (!editor.isEditable || !editor.view.hasFocus()) return;
      useDraftStore.getState().markDraft(noteId, {
        changedChars: measureTransactionChange(transaction),
      });
    };

    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor, noteId]);

  return null;
};

/** Memoized so a parent re-render does not re-fire the subscription. */
export const DraftTrackerBridge = memo(DraftTrackerBridgeImpl);
