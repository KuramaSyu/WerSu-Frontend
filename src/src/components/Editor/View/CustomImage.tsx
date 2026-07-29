// Image node that keeps a raw `style` attribute so users can size
// third-party image URLs without owning them. Emits markdown `![]()` for
// plain images and `<img ... style="...">` when style is set, so the source
// keeps the inline sizing the user typed.

import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "../controllers/ImageNodeView";

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

    if (style) {
      const titleAttr = title ? ` title="${title}"` : "";
      return `<img src="${src}" alt="${alt}"${titleAttr} style="${style}"/>`;
    }

    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
