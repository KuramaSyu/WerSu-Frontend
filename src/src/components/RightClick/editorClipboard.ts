// Shared clipboard helpers for the editor.
//
// Extracted from TextSelectionBubbleMenu so the bubble menu and the
// right-click menu use one implementation instead of two copies.

import type { Editor } from "@tiptap/core";
import { DOMSerializer, type Node as ProseMirrorNode } from "prosemirror-model";
import { copyToClipboard } from "../../zustand/InfoStore";
import { useActiveNoteStore } from "../../zustand/editorStore";

// Plain-text dump of the current selection, or empty when collapsed.
export function getSelectionText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  if (from === to) return "";
  return editor.state.doc.textBetween(from, to, "\n\n");
}

// HTML dump of the current selection, or empty when collapsed.
export function getSelectionHtml(editor: Editor): string {
  if (!editor.view) return "";
  const { from, to } = editor.state.selection;
  if (from === to) return "";
  const slice = editor.state.doc.slice(from, to);
  const serializer = DOMSerializer.fromSchema(editor.schema);
  const wrapper = document.createElement("div");
  wrapper.appendChild(serializer.serializeFragment(slice.content));
  return wrapper.innerHTML;
}

// Copy a whole ProseMirror node (for example a table) as formatted
// HTML plus plain text. Used by context menus when the pointer hit an
// element rather than a text selection.
export async function copyEditorNode(
  editor: Editor | null,
  node: ProseMirrorNode | null | undefined,
): Promise<boolean> {
  if (!editor || !node) return false;
  const serializer = DOMSerializer.fromSchema(editor.schema);
  const wrapper = document.createElement("div");
  wrapper.appendChild(serializer.serializeNode(node));
  const html = wrapper.innerHTML;
  const text = node.textBetween(0, node.content.size, "\n", "\n");
  return writeFormattedClipboard(html, text);
}

// Write html and text to the clipboard; falls back to plain text only.
export async function writeFormattedClipboard(
  html: string,
  text: string,
): Promise<boolean> {
  if (typeof ClipboardItem === "undefined") {
    return copyToClipboard(text);
  }
  const clipboard = navigator.clipboard;
  if (!clipboard?.write) {
    return copyToClipboard(text);
  }
  try {
    await clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch {
    return copyToClipboard(text);
  }
}

// Live editor from the active note store, or null. Cards have none.
export function currentEditor(): Editor | null {
  return useActiveNoteStore.getState().editor;
}

// Copy the editor selection as html and text. Resolves the active
// editor lazily when the caller has no reference of its own.
export async function copyEditorSelection(
  editor: Editor | null = currentEditor(),
): Promise<boolean> {
  if (!editor) return false;
  const html = getSelectionHtml(editor);
  if (!html) return false;
  return writeFormattedClipboard(html, getSelectionText(editor));
}

// Copy the selection, then delete it. Editable editors only.
export async function cutEditorSelection(
  editor: Editor | null = currentEditor(),
): Promise<boolean> {
  if (!editor || !editor.isEditable) return false;
  const copied = await copyEditorSelection(editor);
  if (!copied) return false;
  return editor.chain().focus().deleteSelection().run();
}

// Paste into the editor. Reads text first, then tries clipboard
// images and routes the first image through uploadAttachment. The
// image path is best effort: read() is Chromium-only and may need a
// permission prompt, so any failure leaves the text paste intact.
export async function pasteIntoEditor(
  editor: Editor | null = currentEditor(),
): Promise<boolean> {
  if (!editor || !editor.isEditable) return false;
  const clipboard = navigator.clipboard;
  let pasted = false;

  if (clipboard?.readText) {
    try {
      const text = await clipboard.readText();
      if (text) {
        editor.view.pasteText(text);
        pasted = true;
      }
    } catch {
      // Permission denied: fall through to the image path.
    }
  }

  if (clipboard?.read) {
    try {
      const items = await clipboard.read();
      const imageItem = items.find((item) =>
        item.types.some((type) => type.startsWith("image/")),
      );
      const imageType = imageItem?.types.find((type) =>
        type.startsWith("image/"),
      );
      if (imageItem && imageType) {
        const blob = await imageItem.getType(imageType);
        const extension = imageType.split("/")[1] || "png";
        const file = new File([blob], `pasted-image.${extension}`, {
          type: imageType,
        });
        editor.chain().focus().uploadAttachment(file).run();
        pasted = true;
      }
    } catch {
      // read() unsupported or denied; the text paste already succeeded.
    }
  }

  return pasted;
}
