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
  MarkdownParseResult,
  MarkdownToken,
} from "@tiptap/core";

// Pull summary text and inner content from a `<details>...</details>` raw
// html token. Returns null when the fragment doesn't look like a details
// element so the schema-aware default can take over.
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

export const CustomDetails = Details.extend({
  // prefer raw HTML like `<details>` HTML instead of the stock `:::details` Pandoc syntax.
  markdownTokenName: "html",
  // Disable the Pandoc-style tokenizer so marked's html token isn't
  // preempted by a `:::details` regex that would never match.
  markdownTokenizer: undefined,
  parseMarkdown: (token: MarkdownToken): MarkdownParseResult => {
    if (!token.block) {
      // Returning null here means "this handler doesn't claim this token",
      // which is the documented skip signal in @tiptap/markdown's
      // MarkdownManager. The public type doesn't include null because the
      // editor's surface assumes a result, but the runtime tolerates it.
      return null as unknown as MarkdownParseResult;
    }
    const split = splitDetailsFragment(token.raw);
    if (!split) {
      return null as unknown as MarkdownParseResult;
    }
    const node: JSONContent = {
      type: "details",
      content: [
        {
          type: "detailsSummary",
          content: split.summary ? [{ type: "text", text: split.summary }] : [],
        },
        {
          type: "detailsContent",
          content: split.body
            ? [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: split.body }],
                },
              ]
            : [],
        },
      ],
    };
    return node;
  },
  renderMarkdown: (node: JSONContent): string => {
    const open = node.attrs?.open ? " open" : "";
    let summary = "summary";
    let body = "content";
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (child.type === "detailsSummary") {
          summary =
            child.content
              ?.map((c) => (c.type === "text" ? (c.text ?? "") : ""))
              .join("") || "";
        } else if (child.type === "detailsContent") {
          body =
            child.content
              ?.map((c) =>
                c.type === "paragraph"
                  ? (c.content ?? [])
                      .map((cc) => (cc.type === "text" ? (cc.text ?? "") : ""))
                      .join("")
                  : "",
              )
              .join("\n") || "";
        }
      }
    }
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
