// Raw HTML passthrough nodes for the markdown editor.
//
// Lets users drop arbitrary block HTML (`<details>`, `<aside>`, custom
// widgets) into markdown source and have it round-trip without being
// rewritten to native ProseMirror nodes. `BlockHtml` registers a
// `parseMarkdown` handler for the marked `html` token type that runs
// before the schema-aware fallback, so unknown block tags land in this
// node instead of being stripped to literal text. The actual stored HTML
// is injected into the DOM via a node view that sets `innerHTML`, since
// Tiptap's schema-driven `renderHTML` can't represent arbitrary user HTML.
//
// Inline arbitrary HTML (e.g. `<span>` mid-paragraph) is not currently
// supported beyond `<br/>` and styled `<img>` — the inline `html` token
// path in @tiptap/markdown bypasses registered handlers.

import { Node } from "@tiptap/core";
import type {
  JSONContent,
  MarkdownParseResult,
  MarkdownToken,
} from "@tiptap/core";

const shared = {
  atom: true,
  content: "",
  addAttributes() {
    return {
      html: { default: "" },
    };
  },
  renderMarkdown: (node: JSONContent) =>
    (node.attrs?.html as string | undefined) ?? "",
  // Build a DOM node that injects the saved HTML. Atom + content:"" means
  // the children slot is unused; we own the inner markup entirely.
  addNodeView() {
    return ({ node }: { node: { attrs: { html?: string } } }) => {
      const dom = document.createElement("div");
      dom.className = "custom-html-node";
      dom.innerHTML = node.attrs.html ?? "";
      return { dom };
    };
  },
};

export const BlockHtml = Node.create({
  ...shared,
  name: "blockHtml",
  markdownTokenName: "html",
  group: "block",
  inline: false,
  parseHTML() {
    return [{ tag: "div.custom-html-node" }];
  },
  renderHTML() {
    return [
      "div",
      { "data-type": "custom-html-block", class: "custom-html-node" },
    ];
  },
  // Block html tokens: claim unknown block tags (<details>, <aside>, ...)
  // and let known schema blocks (<table>, <p>, <div>, ...) through.
  parseMarkdown: (token: MarkdownToken): MarkdownParseResult => {
    if (!token.block) {
      // Returning null signals "skip this token"; see CustomDetails for
      // the rationale behind the cast.
      return null as unknown as MarkdownParseResult;
    }
    const html = (token.raw ?? "").trim();
    const tag = /^<([a-zA-Z][\w-]*)/.exec(html)?.[1].toLowerCase();
    if (!tag) {
      return null as unknown as MarkdownParseResult;
    }
    const known = new Set([
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "p",
      "div",
      "blockquote",
      "pre",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      // <details> has its own schema extension; let it win.
      "details",
      "summary",
    ]);
    if (known.has(tag)) {
      return null as unknown as MarkdownParseResult;
    }
    return { type: "blockHtml", attrs: { html: token.raw ?? "" } };
  },
});

// Placeholder kept so existing imports compile. Inline arbitrary HTML is
// not currently supported beyond <br/> and styled <img>; see README.
export const InlineHtml = BlockHtml.extend({ name: "inlineHtml" });

export const CustomHtml = [BlockHtml];
