import { describe, expect, it } from "vitest";
import { markdownPreview, type MarkdownTransform } from "./markdownPreview";

// Each `it` pins one transformation of the stripping pipeline. Keeping
// them as separate cases (instead of one mega-assert) means a regression
// names the step that regressed.

describe("markdownPreview", () => {
  it("returns empty string for empty input", () => {
    expect(markdownPreview("")).toBe("");
  });

  it("flattens a markdown table: header joined with `|`, data rows joined with `,`", () => {
    // Header row cells are separated by `|`, every data row by `,`.
    // The output preserves both — it's the GFM structural difference
    // between the two kinds of rows.
    const raw = [
      "| name | age |",
      "| ---- | --- |",
      "| ada  | 36  |",
      "| bob  | 24  |",
    ].join("\n");
    expect(markdownPreview(raw)).toBe("name | age ada, 36 bob, 24");
  });

  it("flattens a GFM table without leading pipes and link-first cells", () => {
    // Exact shape the user pasted: header row has no leading `|`,
    // the alignment row uses plain `---` separators, and the data
    // rows start with a Markdown link rather than a `|`.
    const raw = [
      "Name | Description | Platform",
      "-----|-------------|----------",
      "[Space Sniffer](https://github.com/redtrillix/SpaceSniffer/releases) | Space Analyzer | Windows",
      "[CompressO](https://github.com/codeforreal1/compressO) | Open Source Video Comporessor, Video compression | Windows, Mac, Linux",
    ].join("\n");
    const out = markdownPreview(raw);
    // None of the GFM scaffolding survives: no `---`, no `(https://`.
    expect(out).not.toContain("---");
    expect(out).not.toContain("(https://");
    // Header keeps `|` between cells; data rows are comma-joined.
    expect(out).toContain("Name | Description | Platform");
    // And each data row's three cells appear, comma-joined, in order.
    expect(out).toContain("Space Sniffer, Space Analyzer, Windows");
    expect(out).toContain(
      "CompressO, Open Source Video Comporessor, Video compression, Windows, Mac, Linux",
    );
  });

  it("keeps fenced code block content but drops the fence markers", () => {
    const raw = "before\n```js\nconst x = 1;\n```\nafter";
    expect(markdownPreview(raw)).toBe("before const x = 1; after");
  });

  it("strips the ``` opening and closing tick lines but never touches the body", () => {
    const raw = [
      "before",
      "",
      "```python",
      "def greet(name):",
      "    return f'Hello, {name}!'",
      "```",
      "",
      "after",
    ].join("\n");
    const out = markdownPreview(raw);
    expect(out).toContain("def greet(name):");
    expect(out).toContain("return f'Hello, {name}!'");
    expect(out).not.toContain("```");
    expect(out).not.toContain("python");
    expect(out.startsWith("before ")).toBe(true);
    expect(out.endsWith(" after")).toBe(true);
  });

  it("keeps inline code text but drops the backticks", () => {
    expect(markdownPreview("use `npm run dev` here")).toBe(
      "use npm run dev here",
    );
  });

  it("strips ATX heading hashes but keeps the heading text", () => {
    expect(markdownPreview("## Section\n### Sub")).toBe("Section Sub");
  });

  it("keeps link text but drops the URL", () => {
    expect(markdownPreview("see [docs](https://example.com) for more")).toBe(
      "see docs for more",
    );
  });

  it("keeps image alt text but drops the URL", () => {
    expect(markdownPreview("![diagram](pic.png) is here")).toBe(
      "diagram is here",
    );
  });

  it("strips unordered and ordered list markers", () => {
    expect(markdownPreview("- one\n- two\n1. three\n2. four")).toBe(
      "one two three four",
    );
  });

  it("strips blockquote markers", () => {
    expect(markdownPreview("> quoted\n>> nested")).toBe("quoted nested");
  });

  it("removes bold and italic markers but keeps the wrapped text", () => {
    expect(markdownPreview("**bold** and __also__ and *em* and _more_")).toBe(
      "bold and also and em and more",
    );
  });

  it("removes horizontal rules", () => {
    expect(markdownPreview("above\n\n---\n\nbelow")).toBe("above below");
  });

  it("collapses runs of whitespace into a single space", () => {
    expect(markdownPreview("a   b\n\n\nc\t\td")).toBe("a b c d");
  });

  it("truncates longer input to maxLength + 100 chars and marks with …", () => {
    // 500-char body -> default limit is 200 -> ellipsis appended.
    const body = "word ".repeat(500);
    const out = markdownPreview(body);
    expect(out.length).toBeLessThanOrEqual(200 + 100);
    expect(out.endsWith("…")).toBe(true);
  });

  it("honours a custom maxLength", () => {
    const body = "x".repeat(50);
    const out = markdownPreview(body, { maxLength: 10 });
    // Truncation threshold is maxLength + 100 = 110, body is only 50 -> no cut.
    expect(out).toBe(body);
  });

  it("strips bold/italic in either order without dropping content", () => {
    expect(markdownPreview("***triple*** and **double**")).toBe(
      "triple and double",
    );
  });

  it("MarkdownTransform interface is shape-compatible with a minimal pass-through impl", () => {
    // Pins the strategy-pattern contract: any object with a `name` and a
    // pure `rewrite(text) -> text` method is a valid transform.
    const identity: MarkdownTransform = {
      name: "identity",
      rewrite: (text) => text,
    };
    expect(identity.rewrite("hello")).toBe("hello");
  });
});
