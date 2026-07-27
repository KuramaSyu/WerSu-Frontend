import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { SvgLinkNodeView } from "../controllers/SvgLinkNodeView";

/**
 * Inline node for `[label](url.svg)` markdown links. Lives next to
 * (not as a replacement for) the upstream `Link` mark — the redirect
 * from link-token to svg-link-node happens in
 * `CustomLink.parseMarkdown`.
 *
 * `inline: true, group: "inline"` so it sits inside a paragraph;
 * `CustomImage` is `group: "block"` and can't, hence this separate
 * node. SVG URLs render as `<a><img></a>`; anything else falls back
 * to `<a>label</a>` so HTML-paste round-trips never break.
 */
export const CustomSvgLink = Node.create({
  name: "svgLink",

  inline: true,
  group: "inline",

  // Allow splitting / editing like a normal inline node.
  atom: false,
  // No nested content; the label lives in `attrs.label`.
  content: "",

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href"),
      },
      label: {
        default: "",
        parseHTML: (element) => element.textContent ?? "",
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("title"),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'a[href$=".svg"]' },
      { tag: 'a[href*=".svg?"]' },
      { tag: 'a[href*=".svg#"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "a",
      mergeAttributes({ rel: "noopener noreferrer" }, HTMLAttributes),
      // Serializer fallback; the React node view owns visible contents.
      [
        "img",
        { src: HTMLAttributes.href ?? "", alt: HTMLAttributes.label ?? "" },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SvgLinkNodeView);
  },
});

export default CustomSvgLink;
