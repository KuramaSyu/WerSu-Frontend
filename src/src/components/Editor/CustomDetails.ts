// Custom wrapper around @tiptap/extension-details that uses raw
// `<details>...</details>` HTML for markdown round-trip instead of the
// Pandoc `:::details` syntax the stock extension ships with.
//
// Markdown parse/render lives in this file and is MUI-free so tests
// can import it without dragging MUI into the bundle. The MUI-rich
// React node views are added separately in
// `controllers/DetailsNodeView.tsx` and only loaded by the live
// editor surfaces.

import { Details } from "@tiptap/extension-details";
import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownParseResult,
  MarkdownRendererHelpers,
  MarkdownToken,
} from "@tiptap/core";

// Split the raw HTML of a `<details>...</details>` token into its
// summary text and body string. Returns null when the fragment is
// malformed or missing a `<summary>` so the caller can fall back to
// the schema-aware default parser.
function splitDetailsFragment(
  raw: string | undefined,
): { summary: string; body: string } | null {
  const html = (raw ?? "").trim();
  if (!html) {
    return null;
  }
  const openMatch = /^<details\b[^>]*>([\s\S]*?)<\/details>\s*$/i.exec(html);
  if (!openMatch) {
    return null;
  }
  const inner = openMatch[1];
  const summaryMatch = /<summary\b[^>]*>([\s\S]*?)<\/summary>/i.exec(inner);
  if (!summaryMatch) {
    return null;
  }
  const summary = summaryMatch[1].trim();
  const body = inner.slice(summaryMatch[0].length).trim();
  return { summary, body };
}

// Custom tokenizer that consumes the entire `<details>...</details>`
// block as a single marked token. Without this, marked splits the
// fragment at the first blank line (its html block rule ends there),
// so the inner content (code blocks, lists, etc.) ends up as siblings
// of the closing `</details>` instead of nested inside the body.
//
// The body string is run back through the lexer's `blockTokens` so any
// markdown inside it is parsed regularly. The resulting block tokens are
// attached to the returned token and consumed by `parseMarkdown` below.
//
// The trailing blank line right after `</details>` is folded into the
// token's raw so the markdown parser doesn't add an extra empty
// paragraph for it. The original code did this implicitly because
// marked's html block rule consumes the trailing blank line too.
const detailsTokenizer = {
  name: "details",
  level: "block" as const,
  start(src: string) {
    const m = /^<details\b/i.exec(src);
    return m ? m.index : -1;
  },
  tokenize(
    src: string,
    _tokens: MarkdownToken[],
    lexer: { blockTokens: (s: string) => MarkdownToken[] },
  ): MarkdownToken | undefined {
    const openMatch = /^<details\b[^>]*>/i.exec(src);
    if (!openMatch) {
      return undefined;
    }
    const closeTag = "</details>";
    let depth = 1;
    let pos = openMatch[0].length;
    while (depth > 0) {
      const nextOpen = src.indexOf("<details", pos);
      const nextClose = src.indexOf(closeTag, pos);
      if (nextClose === -1) {
        return undefined;
      }
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 1;
      } else {
        depth--;
        if (depth === 0) {
          let endIdx = nextClose + closeTag.length;
          // Fold the trailing blank line (one paragraph separator) into
          // the raw so the parser sees it as part of the token rather
          // than as boundary space. Without this, the trailing blank
          // line adds an extra empty paragraph on every round-trip.
          if (src[endIdx] === "\n" && src[endIdx + 1] === "\n") {
            endIdx += 2;
          }
          const raw = src.slice(0, endIdx);
          const inner = src.slice(openMatch[0].length, nextClose);
          const summaryMatch = /<summary\b[^>]*>([\s\S]*?)<\/summary>/i.exec(
            inner,
          );
          if (!summaryMatch) {
            // No summary: skip and let the default html handler take
            // over so the schema can fill in an empty one.
            return undefined;
          }
          const body = inner
            .slice(summaryMatch.index + summaryMatch[0].length)
            .trim();
          const bodyTokens = body ? lexer.blockTokens(body + "\n") : [];
          return {
            type: "details",
            raw,
            tokens: bodyTokens,
          };
        }
        pos = nextClose + 1;
      }
    }
    return undefined;
  },
};

export const CustomDetails = Details.extend({
  // Pin the token name to `details` so the custom tokenizer above is
  // the only handler that claims these tokens. The base Details
  // extension otherwise defaults to `:::details` Pandoc syntax and
  // ships its own tokenizer that we don't want.
  markdownTokenName: "details",
  markdownTokenizer: detailsTokenizer,
  parseMarkdown: (
    token: MarkdownToken,
    helpers: MarkdownParseHelpers,
  ): MarkdownParseResult => {
    const split = splitDetailsFragment(token.raw);
    if (!split) {
      // Returning null here means "this handler doesn't claim this
      // token", which is the documented skip signal in
      // @tiptap/markdown's MarkdownManager. The public type doesn't
      // include null because the editor's surface assumes a result,
      // but the runtime tolerates it.
      return null as unknown as MarkdownParseResult;
    }
    const bodyContent = helpers.parseChildren(token.tokens ?? []);
    const node: JSONContent = {
      type: "details",
      content: [
        {
          type: "detailsSummary",
          content: split.summary ? [{ type: "text", text: split.summary }] : [],
        },
        {
          type: "detailsContent",
          content: bodyContent,
        },
      ],
    };
    return node;
  },
  renderMarkdown: (
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
  ): string => {
    const open = node.attrs?.open ? " open" : "";
    let summary = "summary";
    let bodyContent: JSONContent[] = [];
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (child.type === "detailsSummary") {
          summary =
            child.content
              ?.map((c) => (c.type === "text" ? (c.text ?? "") : ""))
              .join("") || "";
        } else if (child.type === "detailsContent") {
          bodyContent = (child.content ?? []) as JSONContent[];
        }
      }
    }
    const body =
      bodyContent.length > 0 ? helpers.renderChildren(bodyContent, "\n\n") : "";
    return `<details${open}><summary>${summary}</summary>${body}</details>\n\n`;
  },
}).configure({
  // The base extension's node view reads this option at render time, so
  // the override has to go through `.configure()`, not `.extend()`.
  // Customize the toggle button so users see the MUI ExpandMore icon
  // (rotated 180deg when open via CSS). The chevron rotation lives in
  // tiptap.css so the animation timing is co-located with the rest of
  // the details styling.
  renderToggleButton: ({ element, isOpen }) => {
    element.type = "button";
    element.className = "details-toggle";
    // Inline the ExpandMore SVG so the button doesn't depend on a
    // JSX render path — renderToggleButton only hands us a raw DOM
    // element. Using innerHTML is safe here because the SVG is a
    // static, fixed shape with no user content.
    element.innerHTML =
      '<svg class="details-toggle-icon" focusable="false" ' +
      'aria-hidden="true" viewBox="0 0 24 24" ' +
      'data-testid="ExpandMoreIcon">' +
      '<path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z"></path>' +
      "</svg>";
    element.setAttribute(
      "aria-label",
      isOpen ? "Collapse details content" : "Expand details content",
    );
  },
});
