import type { JSONContent } from "@tiptap/react";

/**
 * Normalizes a single table cell so that images are lifted out of paragraphs.
 *
 * Markdown tables parse inline content such as:
 *
 *   | ![](image.png) Hello |
 *
 * into:
 *
 *   tableCell
 *   └─ paragraph
 *      ├─ image
 *      └─ text("Hello")
 *
 * But this structure deletes the image, as soon as the user edits the text.
 * I don't know why. Hence we normalize the content to:
 *
 *   tableCell
 *   ├─ image
 *   └─ paragraph
 *      └─ text("Hello")
 *
 * Paragraphs that do not contain images are left unchanged.
 *
 * @param cell A tableCell node.
 * @returns A normalized copy of the table cell.
 *
 * @limitation paragraph(text, image) will normalize to image, text -> order is lost.
 * The image will be always rendered first.
 */
export function normalizeTableCell(cell: JSONContent): JSONContent {
  const content: JSONContent[] = [];

  for (const child of cell.content ?? []) {
    // Non-paragraph children are already valid cell content.
    if (child.type !== "paragraph") {
      content.push(child);
      continue;
    }

    const paragraphContent = child.content ?? [];

    // Only rewrite paragraphs that actually contain images.
    const hasImage = paragraphContent.some((node) => node.type === "image");

    if (!hasImage) {
      content.push(child);
      continue;
    }

    const images: JSONContent[] = [];
    const rest: JSONContent[] = [];

    // Split paragraph content into images and everything else.
    for (const inline of paragraphContent) {
      if (inline.type === "image") {
        images.push(inline);
      } else {
        rest.push(inline);
      }
    }

    // Images become direct children of the table cell.
    content.push(...images);

    // Remaining inline content stays wrapped in a paragraph.
    if (rest.length > 0) {
      content.push({
        ...child,
        content: rest,
      });
    }
  }

  return {
    ...cell,
    content,
  };
}

/**
 * Recursively traverses a Tiptap JSON document and normalizes all table cells.
 *
 * This is intended to run immediately after Markdown deserialization:
 *
 *   markdown -> parse() -> normalizeTables() -> setContent()
 *
 * so that imported table cells follow our preferred structure before they are
 * rendered or edited.
 *
 * @param node Root node to normalize.
 * @returns A normalized copy of the node tree.
 */
export function normalizeTables(node: JSONContent): JSONContent {
  const normalized =
    node.type === "tableCell" ? normalizeTableCell(node) : { ...node };

  if (normalized.content) {
    normalized.content = normalized.content.map(normalizeTables);
  }

  return normalized;
}
