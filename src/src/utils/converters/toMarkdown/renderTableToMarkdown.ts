// Pure helpers shared by TableControlls.tsx and jsdom tests. Reimplements
// extension-table@3.26.x renderTableToMarkdown without collapseWhitespace
// so <br/>-separated cell lines survive a round-trip. Kept MUI-free.

// Render each cell child separately, join lines with <br/>, and
// collapse only intra-line whitespace. | is backslash-escaped so the
// cell splitter does not break on a literal pipe. Uses h.renderChild
// (not h.renderChildren) so a list child's own \n-separator is honoured.
export function assembleCellText(
  h: { renderChild: (n: unknown, i: number) => string },
  content: unknown,
): string {
  const children = Array.isArray(content) ? content : content ? [content] : [];
  if (children.length === 0) return "";
  const lines: string[] = [];
  for (let i = 0; i < children.length; i += 1) {
    const raw = h.renderChild(children[i], i);
    for (const part of raw.split(/\r?\n/)) {
      const cleaned = part.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
      if (cleaned.length > 0) lines.push(cleaned);
    }
  }
  // Paragraph + inline latex children came from one paragraph (the
  // table-cell normalizer lifted the math out). Joining with <br/> would
  // split the cell line at the latex boundary, so use an empty join.
  if (children.length > 1 && isInlineStyleChildren(children)) {
    return lines.join("");
  }
  return lines.join("<br/>");
}

// True when the cell's block children are paragraphs + inline math.
function isInlineStyleChildren(children: unknown[]): boolean {
  let hasInlineMath = false;
  for (const c of children) {
    const type = (c as { type?: string })?.type;
    if (type === "inlineMath") {
      hasInlineMath = true;
    } else if (type !== "paragraph") {
      return false;
    }
  }
  return hasInlineMath;
}

// Reimplementation of extension-table@3.26.x renderTableToMarkdown.
export function renderWerSuTable(
  node: {
    content?: Array<{
      content?: Array<{
        type: string;
        attrs?: Record<string, unknown>;
        content?: unknown;
      }>;
    }> | null;
  },
  h: { renderChild?: (n: unknown, i: number) => string },
): string {
  if (!node.content || node.content.length === 0) return "";
  type Row = { text: string; isHeader: boolean }[];
  const rows: Row[] = [];
  for (const rowNode of node.content) {
    const cells: Row = [];
    if (rowNode.content) {
      for (const cellNode of rowNode.content) {
        cells.push({
          text: assembleCellText(
            { renderChild: h.renderChild ?? (() => "") },
            cellNode.content,
          ),
          isHeader: cellNode.type === "tableHeader",
        });
      }
    }
    rows.push(cells);
  }
  const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  if (columnCount === 0) return "";
  const colWidths: number[] = new Array(columnCount).fill(0);
  for (const r of rows) {
    for (let i = 0; i < columnCount; i += 1) {
      const t = r[i]?.text || "";
      colWidths[i] = Math.max(colWidths[i], t.length, 3);
    }
  }
  const pad = (s: string, w: number) =>
    s + " ".repeat(Math.max(0, w - s.length));
  const headerRow = rows[0];
  const hasHeader = headerRow.some((c) => c.isHeader);
  let out = "\n";
  const headerTexts = new Array(columnCount)
    .fill(0)
    .map((_, i) => (hasHeader ? headerRow[i]?.text || "" : ""));
  out += `| ${headerTexts.map((t, i) => pad(t, colWidths[i])).join(" | ")} |\n`;
  out += `| ${colWidths.map((w) => "-".repeat(Math.max(3, w))).join(" | ")} |\n`;
  const body = hasHeader ? rows.slice(1) : rows;
  for (const r of body) {
    out += `| ${new Array(columnCount)
      .fill(0)
      .map((_, i) => pad(r[i]?.text || "", colWidths[i]))
      .join(" | ")} |\n`;
  }
  return out;
}