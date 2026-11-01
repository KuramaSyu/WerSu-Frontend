// Round-trip tests for the custom HTML passthrough extensions:
// <br/> survives table cells, <img style="..."> keeps its size, and
// arbitrary tags like <details> round-trip verbatim.

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, describe, expect, it } from "vitest";
import { Editor, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";

import { CustomHtml, formatCustomHtml } from "./CustomHtml";
import { CustomHardBreak } from "./CustomHardBreak";
import { CustomDetails } from "./CustomDetails";
import { DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { markdownToProsemirror } from "../../utils/converters/toProsemirror/markdownToProsemirror";

// Inline copy of the style-aware image so the test stays free of
// @tiptap/react (which transitively pulls MUI and breaks ESM resolution
// under jsdom).
const ImageWithStyle = Image.extend({
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      height: { default: null },
      style: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("style"),
        renderHTML: (a: { style?: string | null }) =>
          a.style ? { style: a.style } : {},
      },
    };
  },
  renderMarkdown: (node: { attrs?: Record<string, string | null> }) => {
    const a = node.attrs ?? {};
    if (a.style) {
      const titleAttr = a.title ? ` title="${a.title}"` : "";
      return `<img src="${a.src ?? ""}" alt="${a.alt ?? ""}"${titleAttr} style="${a.style}"/>`;
    }
    return a.title
      ? `![${a.alt ?? ""}](${a.src ?? ""} "${a.title}")`
      : `![${a.alt ?? ""}](${a.src ?? ""})`;
  },
});

// StarterKit's `codeBlock` is disabled in this test to avoid pulling
// MUI via the node view, but the markdown parser still needs a
// `parseMarkdown` handler for the marked `code` token type so fenced
// code blocks inside other nodes (e.g. <details>) round-trip
// correctly. The minimal stub below does the job without dragging in
// prosemirror-highlight.
const StubCodeBlock = Node.create({
  name: "codeBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  addAttributes() {
    return { language: { default: null } };
  },
  parseHTML() {
    return [{ tag: "pre" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["pre", HTMLAttributes, ["code", {}, 0]];
  },
  markdownTokenName: "code",
  parseMarkdown: (token, helpers) =>
    helpers.createNode(
      "codeBlock",
      { language: token.lang || null },
      token.text ? [helpers.createTextNode(token.text)] : [],
    ),
  renderMarkdown: (node, h) => {
    const lang = node.attrs?.language ?? "";
    const text = h.renderChildren(node.content || []);
    return `\`\`\`${lang}\n${text}\n\`\`\``;
  },
});

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        undoRedo: false,
        hardBreak: false,
      }),
      StubCodeBlock,
      CustomHardBreak,
      ImageWithStyle,
      ...CustomHtml,
      CustomDetails,
      DetailsSummary,
      DetailsContent,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Markdown,
    ],
  });
}

const editors: Editor[] = [];

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

function freshEditor(): Editor {
  const e = makeEditor();
  editors.push(e);
  return e;
}

describe("CustomHardBreak (<br/>) round-trip", () => {
  it("emits <br/> in a paragraph instead of two-space newline", () => {
    const editor = freshEditor();
    editor.commands.setContent("line one  \nline two", {
      contentType: "markdown",
    });

    const out = editor.getMarkdown();

    expect(out).toContain("<br/>");
  });

  it("keeps a table intact when a cell contains a <br/>", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "| a | b |\n| --- | --- |\n| line one<br/>line two | x |\n",
      { contentType: "markdown" },
    );

    const out = editor.getMarkdown();

    expect(out).toContain("<br/>");
    expect(out).toContain("| --- |");
    // The table separator must survive; cell text must still contain <br/>.
    expect(out.replace(/\s+/g, " ")).toContain("line one<br/>line two");
  });
});

describe("CustomImage with style attribute", () => {
  it('round-trips <img style="width: 200px"> via markdown source', () => {
    const editor = freshEditor();
    editor.commands.setContent(
      `<img src="http://x/a.png" alt="a" style="width: 200px"/>`,
      { contentType: "markdown" },
    );

    const out = editor.getMarkdown();

    expect(out).toContain(`src="http://x/a.png"`);
    expect(out).toContain(`style="width: 200px"`);
    expect(out).toContain("<img");
  });

  it("falls back to markdown image syntax when no style is set", () => {
    const editor = freshEditor();
    editor.commands.setContent(`![a](http://x/a.png)`, {
      contentType: "markdown",
    });

    const out = editor.getMarkdown();

    expect(out).toContain("![a](http://x/a.png)");
    expect(out).not.toContain("<img");
  });
});

describe("CustomHtml passthrough", () => {
  it("round-trips an <aside> block verbatim", () => {
    const editor = freshEditor();
    editor.commands.setContent("<aside>body</aside>", {
      contentType: "markdown",
    });

    const out = editor.getMarkdown();

    expect(out).toContain("<aside>");
    expect(out).toContain("body");
  });

  it("renders the stored HTML in the editor DOM", () => {
    const editor = freshEditor();
    editor.commands.setContent("<aside>body</aside>", {
      contentType: "markdown",
    });

    const dom = editor.view.dom as HTMLElement;
    // BlockHtml's node view wraps the saved HTML inside a div; the user's
    // <aside> sits inside that wrapper.
    const aside = dom.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.textContent).toBe("body");
  });
});

describe("CustomDetails (<details>) extension", () => {
  it("round-trips a <details> block via HTML, not Pandoc", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<details><summary>more</summary>body</details>",
      { contentType: "markdown" },
    );

    const out = editor.getMarkdown();

    expect(out).toContain("<details>");
    expect(out).toContain("<summary>more</summary>");
    expect(out).toContain("body");
    // Must not use the stock Pandoc syntax.
    expect(out).not.toContain(":::details");
  });

  it("renders with a toggle button and hidden content (collapsed by default)", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<details><summary>click</summary>hidden body</details>",
      { contentType: "markdown" },
    );

    const dom = editor.view.dom as HTMLElement;
    const wrapper = dom.querySelector('div[data-type="details"]');
    const summary = dom.querySelector("summary");
    const content = dom.querySelector('[data-type="detailsContent"]');
    const button = wrapper?.querySelector("button");

    expect(wrapper).not.toBeNull();
    expect(button).not.toBeNull();
    expect(summary?.textContent).toBe("click");
    // Content is hidden until the user toggles the details open.
    expect(content?.getAttribute("hidden")).toBe("hidden");
    expect(content?.textContent).toContain("hidden body");
  });

  it("does not leave trailing-break ghosts when body or summary is empty", () => {
    const editor = freshEditor();
    editor.commands.setContent("<details><summary>x</summary></details>", {
      contentType: "markdown",
    });

    const dom = editor.view.dom as HTMLElement;
    const summary = dom.querySelector("summary");
    const content = dom.querySelector('[data-type="detailsContent"]');

    // No stray <br class="ProseMirror-trailingBreak"> inside summary or
    // content — that would make them invisible to the user.
    expect(summary?.querySelector(".ProseMirror-trailingBreak")).toBeNull();
    expect(content?.querySelector(".ProseMirror-trailingBreak")).toBeNull();
  });

  it("survives a source -> rich -> source round-trip with empty body", () => {
    const editor = freshEditor();
    const src = "<details><summary>x</summary></details>";
    editor.commands.setContent(src, { contentType: "markdown" });

    const once = editor.getMarkdown();
    editor.commands.setContent(once, { contentType: "markdown" });
    const twice = editor.getMarkdown();

    expect(once).toContain("<details><summary>x</summary></details>");
    expect(twice).toBe(once);
  });

  it("handles <details> with empty summary tag", () => {
    const editor = freshEditor();
    editor.commands.setContent("<details><summary></summary></details>", {
      contentType: "markdown",
    });

    const out = editor.getMarkdown();

    // Empty summary still round-trips (empty text nodes would otherwise
    // be rejected by ProseMirror and the whole details element dropped).
    expect(out).toContain("<details>");
    expect(out).toContain("<summary></summary>");
    expect(out).toContain("</details>");
  });

  it("handles <details></details> with no summary at all", () => {
    const editor = freshEditor();
    editor.commands.setContent("<details></details>", {
      contentType: "markdown",
    });

    const out = editor.getMarkdown();

    // Schema requires detailsSummary, so an empty one is added on parse.
    expect(out).toContain("<details>");
    expect(out).toContain("<summary></summary>");
    expect(out).toContain("</details>");
  });

  it("renders a visible chevron toggle button (collapsed by default)", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<details><summary>click</summary>hidden body</details>",
      { contentType: "markdown" },
    );

    const dom = editor.view.dom as HTMLElement;
    const button = dom.querySelector(
      'div[data-type="details"] > button.details-toggle',
    );
    const icon = button?.querySelector("svg.details-toggle-icon");
    const content = dom.querySelector('[data-type="detailsContent"]');

    // The toggle button must render an SVG chevron (MUI ExpandMore
    // inline), not text.
    expect(icon).not.toBeNull();
    expect(button?.textContent?.trim()).toBe("");
    // Default state: closed, content hidden.
    expect(content?.hasAttribute("hidden")).toBe(true);
  });

  it("opens when the toggle button is clicked", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      "<details><summary>click</summary>hidden body</details>",
      { contentType: "markdown" },
    );

    const dom = editor.view.dom as HTMLElement;
    const button = dom.querySelector(
      'div[data-type="details"] > button.details-toggle',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    button!.click();

    const content = dom.querySelector('[data-type="detailsContent"]');
    expect(content?.hasAttribute("hidden")).toBe(false);
    // Wrapper flips to is-open so the CSS rotation kicks in.
    const wrapper = dom.querySelector('div[data-type="details"]');
    expect(wrapper?.classList.contains("is-open")).toBe(true);
  });

  // Regression: a fenced code block inside <details> used to be torn
  // out of the element. Marked's html block rule ends at a blank line,
  // so the fragment was split into three tokens (open tag, code block,
  // close tag) and the code block landed as a sibling instead of being
  // nested inside the details content. The CustomDetails tokenizer now
  // consumes the whole <details>...</details> as one block so the body
  // gets tokenized normally.
  it("nests a fenced code block inside <details> (not as a sibling)", () => {
    const editor = freshEditor();
    const src =
      "<details>\n" +
      "  <summary>Generate gnupg key</summary>\n" +
      "\n" +
      "```\n" +
      "code\n" +
      "```\n" +
      "</details>";
    editor.commands.setContent(src, { contentType: "markdown" });

    // ProseMirror's `JSONContent` is a `NodeType | TextType` union,
    // and `TextType` carries no `type` / `content` fields. Cast the doc
    // to it to prevent typing issue
    type DocNode = {
      type?: string;
      content?: DocNode[];
    };
    const doc = editor.getJSON() as unknown as DocNode;
    const details = doc.content?.find((n) => n.type === "details");
    expect(details).toBeDefined();

    const body = details!.content?.find(
      (n) => n.type === "detailsContent",
    )?.content;
    // The body must contain a codeBlock, not a paragraph wrapping the
    // raw fence text.
    expect(body?.some((n) => n.type === "codeBlock")).toBe(true);
    expect(body?.some((n) => n.type === "paragraph")).toBe(false);

    // The code block must NOT be a sibling of the details element.
    expect(doc.content?.some((n) => n.type === "codeBlock")).toBe(false);

    // Round-trip preserves the fenced code block inside the details.
    const out = editor.getMarkdown();
    expect(out).toContain("<details>");
    expect(out).toContain("<summary>Generate gnupg key</summary>");
    expect(out).toContain("```");
    expect(out).toContain("code");
    expect(out).toContain("</details>");
  });
});

describe("CustomImage visual style", () => {
  it("applies the style attribute to the rendered img", () => {
    const editor = freshEditor();
    editor.commands.setContent(
      `<img src="http://x/a.png" alt="a" style="width: 200px"/>`,
      { contentType: "markdown" },
    );

    const dom = editor.view.dom as HTMLElement;
    const img = dom.querySelector("img");

    expect(img).not.toBeNull();
    // Style is parsed and applied to the element directly.
    expect((img as HTMLImageElement).style.width).toBe("200px");
  });
});

describe("CustomHtml preservation for schema-known tags", () => {
  // A custom-styled table must stay a real, editable table in the rich
  // view, but serialize back to the exact HTML the user typed. Rendering
  // it as markdown would silently drop the style attribute the schema
  // does not model.
  const styledTable =
    '<table style="width: 100%; border: 1px solid red"><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';

  it("parses a styled <table> into a real table node", () => {
    const editor = freshEditor();
    editor.commands.setContent(styledTable, { contentType: "markdown" });

    const doc = editor.getJSON() as unknown as {
      content?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
    };
    expect(doc.content?.[0]?.type).toBe("table");
    // The raw HTML is persisted on the node so serialization can use it.
    expect(doc.content?.[0]?.attrs?.htmlSource).toBe(styledTable);

    // And the rich view renders an actual <table> element.
    const dom = editor.view.dom as HTMLElement;
    expect(dom.querySelector("table")).not.toBeNull();
  });

  it("serializes the styled <table> back as HTML, not markdown", () => {
    const editor = freshEditor();
    editor.commands.setContent(styledTable, { contentType: "markdown" });

    const out = editor.getMarkdown();

    expect(out).toContain("<table");
    expect(out).toContain('style="width: 100%; border: 1px solid red"');
    // It must not have been rewritten to a markdown pipe table.
    expect(out).not.toContain("| --- |");
  });

  it("survives a source -> rich -> source round-trip", () => {
    const editor = freshEditor();
    editor.commands.setContent(styledTable, { contentType: "markdown" });

    const once = editor.getMarkdown();
    editor.commands.setContent(once, { contentType: "markdown" });
    const twice = editor.getMarkdown();

    // The custom table is written back as indented HTML...
    expect(once).toContain("<table");
    expect(once).toContain('style="width: 100%; border: 1px solid red"');
    expect(once).toMatch(/\n {2}<tbody>/);
    // ...and the formatting is stable across re-imports.
    expect(twice).toBe(once);
  });

  it("preserves other known block tags (<div>) as HTML", () => {
    const editor = freshEditor();
    const src = '<div class="note-box"><p>hello</p></div>';
    editor.commands.setContent(src, { contentType: "markdown" });

    const out = editor.getMarkdown();

    expect(out).toContain('<div class="note-box">');
    expect(out).toContain("<p>hello</p>");
  });

  it("keeps markdown tables that were not written as HTML as markdown", () => {
    const editor = freshEditor();
    editor.commands.setContent("| a | b |\n| --- | --- |\n| c | d |\n", {
      contentType: "markdown",
    });

    const out = editor.getMarkdown();

    expect(out).toContain("| --- |");
    expect(out).not.toContain("<table");
  });

  it("does not leak the internal htmlSource attribute into the DOM", () => {
    const editor = freshEditor();
    editor.commands.setContent(styledTable, { contentType: "markdown" });

    const dom = editor.view.dom as HTMLElement;
    expect(dom.innerHTML).not.toContain("htmlSource");
  });

  it("preserves htmlSource when serializing the manager directly", () => {
    const editor = freshEditor();
    editor.commands.setContent(styledTable, { contentType: "markdown" });

    // editor.getMarkdown() routes through manager.serialize; assert the
    // manager itself also preserves, so a caller that bypasses
    // getMarkdown cannot silently drop the raw HTML.
    const direct = editor.storage.markdown.manager.serialize(editor.getJSON());

    expect(direct).toContain("<table");
    expect(direct).toContain('style="width: 100%; border: 1px solid red"');
    expect(direct).not.toContain("| --- |");
  });

  it("keeps htmlSource through the collab normalization path", () => {
    const editor = freshEditor();
    // markdownToProsemirror runs normalizeTables/normalizeListInCells,
    // which must not strip the preservation attribute off the table.
    const doc = markdownToProsemirror(editor, styledTable) as unknown as {
      content?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
    };

    expect(doc.content?.[0]?.type).toBe("table");
    expect(doc.content?.[0]?.attrs?.htmlSource).toBe(styledTable);
  });
});

describe("formatCustomHtml", () => {
  it("indents nested block elements with two spaces", () => {
    expect(
      formatCustomHtml(
        '<table style="border:1px solid red"><tbody><tr><td>a</td></tr></tbody></table>',
      ),
    ).toBe(
      [
        '<table style="border:1px solid red">',
        "  <tbody>",
        "    <tr>",
        "      <td>a</td>",
        "    </tr>",
        "  </tbody>",
        "</table>",
      ].join("\n"),
    );
  });

  it("keeps inline markup on a single line", () => {
    expect(
      formatCustomHtml(
        '<div class="callout"><p><strong>Heads up</strong> now</p></div>',
      ),
    ).toBe(
      [
        '<div class="callout">',
        "  <p><strong>Heads up</strong> now</p>",
        "</div>",
      ].join("\n"),
    );
  });

  it("leaves whitespace-sensitive tags untouched", () => {
    const html = "<pre><code>a\n  b</code></pre>";
    expect(formatCustomHtml(html)).toBe(html);
  });

  it("is idempotent", () => {
    const once = formatCustomHtml(
      '<div><ul><li>one</li><li>two</li></ul><p>after</p></div>',
    );
    expect(formatCustomHtml(once)).toBe(once);
  });

  it("returns empty/failed input unchanged", () => {
    expect(formatCustomHtml("")).toBe("");
    expect(formatCustomHtml("   ")).toBe("   ");
  });
});

describe("CustomHtml regeneration after editing a preserved table", () => {
  // Rich custom table with per-cell styles, so we can assert both the
  // table-level and cell-level styling survive an edit.
  const richTable =
    '<table style="border:2px solid #7c3aed"><thead><tr><th style="background:#ede9fe">A</th><th>B</th></tr></thead><tbody><tr><td style="padding:8px">1</td><td>2</td></tr></tbody></table>';

  it("pretty-prints the original HTML on output while unedited", () => {
    const editor = freshEditor();
    editor.commands.setContent(richTable, { contentType: "markdown" });

    const out = editor.getMarkdown();

    expect(out).toContain('<table style="border:2px solid #7c3aed">');
    // Two-space indentation, one level per nested block.
    expect(out).toMatch(/\n {2}<t(?:head|body|foot)>/);
    expect(out).toMatch(/\n {4}<tr>/);
    expect(out).toMatch(/\n {6}<td style="padding:8px">1<\/td>/);

    // Re-importing the formatted HTML keeps it stable.
    editor.commands.setContent(out, { contentType: "markdown" });
    expect(editor.getMarkdown()).toBe(out);
  });

  it("regenerates the HTML when a row is added and keeps custom styles", () => {
    const editor = freshEditor();
    editor.commands.setContent(richTable, { contentType: "markdown" });
    // Put the caret in the first cell, then add a row after it.
    editor.commands.setTextSelection(4);
    editor.chain().addRowAfter().run();

    const out = editor.getMarkdown();

    // Table- and cell-level styles survive the regeneration.
    expect(out).toContain("border:2px solid #7c3aed");
    expect(out).toContain("background:#ede9fe");
    expect(out).toContain("padding:8px");
    // Header + the original body row + the new body row.
    expect((out.match(/<tr/g) ?? []).length).toBe(3);
    // No schema `<colgroup>` noise was introduced.
    expect(out).not.toContain("<colgroup");
  });

  it("keeps cell styles aligned when a row is inserted in the middle", () => {
    const editor = freshEditor();
    const src =
      '<table style="border:2px solid #7c3aed"><thead><tr><th>H</th></tr></thead><tbody><tr><td style="padding:1px">1</td></tr><tr><td style="padding:2px">2</td></tr></tbody></table>';
    editor.commands.setContent(src, { contentType: "markdown" });

    let textPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === "1") {
        textPos = pos;
        return false;
      }
      return true;
    });
    editor.commands.setTextSelection(textPos);
    editor.chain().addRowAfter().run();

    const parsed = new DOMParser().parseFromString(
      editor.getMarkdown(),
      "text/html",
    );
    const cells = Array.from(parsed.querySelectorAll("td"));
    const cell1 = cells.find((cell) => cell.textContent?.trim() === "1");
    const cell2 = cells.find((cell) => cell.textContent?.trim() === "2");

    expect(cell1?.getAttribute("style")).toBe("padding:1px");
    expect(cell2?.getAttribute("style")).toBe("padding:2px");
  });

  it("reflects a cell text edit and keeps the surrounding styles", () => {
    const editor = freshEditor();
    editor.commands.setContent(richTable, { contentType: "markdown" });

    let textPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === "1") {
        textPos = pos;
        return false;
      }
      return true;
    });
    expect(textPos).toBeGreaterThanOrEqual(0);
    editor.commands.insertContentAt({ from: textPos, to: textPos + 1 }, "one");

    const out = editor.getMarkdown();

    expect(out).toContain("one");
    expect(out).toContain("border:2px solid #7c3aed");
    expect(out).toContain("padding:8px");
  });

  it("is stable across a regeneration round-trip", () => {
    const editor = freshEditor();
    editor.commands.setContent(richTable, { contentType: "markdown" });
    editor.commands.setTextSelection(4);
    editor.chain().addRowAfter().run();

    const once = editor.getMarkdown();
    editor.commands.setContent(once, { contentType: "markdown" });
    const twice = editor.getMarkdown();

    expect(twice).toBe(once);
  });
});
