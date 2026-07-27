import Link from "@tiptap/extension-link";
import { mergeAttributes } from "@tiptap/core";
import { prepareBackendLink } from "../../../utils/prepareBackendLink";

/**
 * `Link` re-exported with overrides on top of the upstream mark.
 *
 * - `renderHTML` rewrites `href` through `prepareBackendLink` so the
 *   `<a>` opens `${BACKEND_BASE}/...` instead of resolving against
 *   the editor's origin.
 * - `parseMarkdown` unwraps CommonMark's nested-link lossiness:
 *   `[label]([inner-label](/api/...))` ends up with the inner URL.
 * - `parseMarkdown` redirects `.svg` link tokens (href or label
 *   ends in `.svg`) to the `CustomSvgLink` node so the SVG renders
 *   inline. The label check covers attachment URLs whose path
 *   doesn't carry the extension.
 */
export const CustomLink = Link.extend({
  renderHTML({ HTMLAttributes }) {
    const href = prepareBackendLink(HTMLAttributes.href);
    return [
      "a",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { href }),
      0,
    ];
  },
  parseMarkdown(token, helpers) {
    // Unwrap `[label]([inner-label](url))` -> outer href becomes `url`.
    const unwrapped = String(token.href ?? "").match(
      /^\[.*?\]\((https?:\/\/[^)]+|\/[^)]+)\)$/,
    );
    const href = unwrapped ? unwrapped[1] : token.href;

    // Redirect `.svg` links to the `CustomSvgLink` node.
    const label = String(token.text ?? "");
    const hrefLooksSvg = /\.svg(?:[?#]|$)/i.test(String(href ?? ""));
    const labelLooksSvg = /\.svg$/i.test(label);
    if (hrefLooksSvg || labelLooksSvg) {
      return helpers.createNode("svgLink", {
        href,
        label,
        title: token.title || null,
      });
    }

    return helpers.applyMark("link", helpers.parseInline(token.tokens || []), {
      href,
      title: token.title || null,
    });
  },
});

export default CustomLink;
