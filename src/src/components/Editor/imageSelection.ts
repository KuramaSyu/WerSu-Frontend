// Shared helpers for acting on a selected image node. Used by the image
// bubble menu and the right-rail formatting panel so both surfaces write
// the same style/size representation.

import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  defaultImageResizeStrategy,
  type ImageDimension,
} from "./imageResizeStrategy";

/** Returns the currently selected image node, or null. */
export function getSelectedImage(editor: Editor): ProseMirrorNode | null {
  const { selection } = editor.state;
  if (
    selection instanceof NodeSelection &&
    selection.node.type.name === "image"
  ) {
    return selection.node;
  }
  return null;
}

/** Write a new width onto the selected image, preserving other styles. */
export function applyImageWidth(editor: Editor, width: ImageDimension): void {
  const node = getSelectedImage(editor);
  if (!node) return;
  editor
    .chain()
    .focus()
    .updateAttributes("image", {
      style: defaultImageResizeStrategy.serialize(
        { width, height: null },
        node.attrs.style as string | null,
      ),
    })
    .run();
}

/** Delete the selected image node. */
export function deleteSelectedImage(editor: Editor): void {
  editor.chain().focus().deleteSelection().run();
}
