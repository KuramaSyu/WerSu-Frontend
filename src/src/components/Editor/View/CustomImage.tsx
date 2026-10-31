// Image node that keeps a raw `style` attribute so users can size
// third-party image URLs without owning them. Emits markdown `![]()` for
// plain images and `<img ... style="...">` when style is set, so the source
// keeps the inline sizing the user typed.

import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "../controllers/ImageNodeView";
import { parseStyleDeclarations } from "../imageResizeStrategy";

/**
 * True when a style string only expresses "full width, auto height"
 * (`width: 100%; height: auto`). That is equivalent to an unsized image,
 * so it is emitted as plain `![alt](src)` markdown rather than an
 * `<img>` HTML block. Any other declaration keeps the HTML form so no
 * styling is lost.
 */
function isDefaultFullWidthStyle(style: string): boolean {
  const declarations = parseStyleDeclarations(style);
  if (declarations.length === 0) return false;

  let hasFullWidth = false;
  for (const [key, value] of declarations) {
    const normalizedValue = value.replace(/\s+/g, "").toLowerCase();
    switch (key.toLowerCase()) {
      case "width":
        if (normalizedValue !== "100%") return false;
        hasFullWidth = true;
        break;
      case "height":
        if (normalizedValue !== "auto") return false;
        break;
      default:
        return false;
    }
  }

  return hasFullWidth;
}

export const CustomImage = Image.extend({
  inline: false,
  group: "block",

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      height: { default: null },
      style: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("style"),
        renderHTML: (attrs: { style?: string | null }) =>
          attrs.style ? { style: attrs.style } : {},
      },
    };
  },

  renderMarkdown: (node) => {
    const attrs = node.attrs ?? {};
    const src = attrs.src ?? "";
    const alt = attrs.alt ?? "";
    const title = attrs.title ?? "";
    const style = attrs.style ?? "";

    if (style && !isDefaultFullWidthStyle(style)) {
      const titleAttr = title ? ` title="${title}"` : "";
      return `<img src="${src}" alt="${alt}"${titleAttr} style="${style}"/>`;
    }

    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
