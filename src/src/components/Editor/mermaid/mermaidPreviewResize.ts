// Keeps the caret in the right place when the Mermaid preview changes size.
//
// The preview is rendered asynchronously (debounced `mermaid.render`), so the
// diagram grows or shrinks *outside* any ProseMirror transaction. It renders
// below the code block, so the edited code no longer moves - but content
// below the diagram does, and browsers keep painting the native caret at its
// previous coordinates until the selection itself is written again.
//
// `EditorView.focus()` (which runs ProseMirror's `selectionToDOM`) is NOT
// enough here: prosemirror-view skips writing a DOM selection whose endpoints
// already match its state, and that early return is exactly our situation -
// the logical selection never moved, only the layout around it did. So the
// DOM selection is rebuilt explicitly, which makes the browser recompute and
// repaint the caret at its real position.

import type { Editor } from "@tiptap/core";

/**
 * Forces the browser to re-locate and repaint the caret after the preview's
 * size changed.
 *
 * Guarded so it never steals focus from another field and never rewrites the
 * selection during an IME composition.
 */
export const syncCaretAfterPreviewResize = (editor: Editor): void => {
  const { view } = editor;
  if (!view.hasFocus() || view.composing) {
    return;
  }

  const doc = view.dom.ownerDocument;
  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
  if (
    !anchorNode ||
    !focusNode ||
    !view.dom.contains(anchorNode) ||
    !view.dom.contains(focusNode)
  ) {
    return;
  }

  // Clearing first matters: re-adding the same range in one go can be
  // treated as a no-op, while the empty intermediate state always
  // invalidates the caret's cached paint rect.
  selection.removeAllRanges();
  const range = doc.createRange();
  range.setStart(anchorNode, anchorOffset);
  range.setEnd(focusNode, focusOffset);
  selection.addRange(range);
};