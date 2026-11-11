import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";

/**
 * Tracks `editor.isEditable` reactively.
 *
 * `setEditable()` emits the editor `update` event but does **not**
 * dispatch a state transaction, so none of the `useEditorState`
 * subscriptions observe it. Every bubble menu gates its visibility on
 * editability, so without this the menu can render against a stale
 * `isEditable` and never re-evaluate when the note flips between read
 * and write mode.
 *
 * React bails out of a state update when the value is unchanged, so the
 * per-keystroke `update`/`transaction` events stay cheap.
 */
export function useEditorEditable(editor: Editor): boolean {
  const [editable, setEditable] = useState(editor.isEditable);

  useEffect(() => {
    const sync = () => setEditable(editor.isEditable);
    sync();
    editor.on("update", sync);
    editor.on("transaction", sync);
    return () => {
      editor.off("update", sync);
      editor.off("transaction", sync);
    };
  }, [editor]);

  return editable;
}
