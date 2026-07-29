// Round-trip tests for the custom HTML passthrough extensions:
// <br/> survives table cells, <img style="..."> keeps its size, and
// arbitrary tags like <details> round-trip verbatim.

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";

import { CustomHtml } from "./CustomHtml";
import { CustomHardBreak } from "./CustomHardBreak";
import { CustomDetails } from "./CustomDetails";
import { DetailsContent, DetailsSummary } from "@tiptap/extension-details";

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

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        undoRedo: false,
        hardBreak: false,
      }),
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
