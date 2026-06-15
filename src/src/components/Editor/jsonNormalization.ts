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
    // if (child.type !== "paragraph") {
    //   content.push(child);
    //   continue;
    // }
    // Paragraphs that contain images are normalized by destructuring the paragraph

    // const paragraphContent = child.content ?? [];

    // Only rewrite paragraphs that actually contain images.
    // const hasImage = paragraphContent.some((node) => node.type === "image");
    // if (!hasImage) {
    //   content.push(child);
    //   continue;
    // }

    // destrcut paragraph into its children to extract images out of paragraphs
    content.push(...destructParagraph(child));
  }
  return {
    ...cell,
    content,
  };
}

/**
 * Destrcuts a paragraph node into its non-paragraph children recursively.
 * A non paragraph node A is returned as JSONContent[] = [A].
 * A text node is wrapped as a paragraph. Otherwise it's rejected from tiptap.
 * @param paragraph A paragraph node to destructure.
 * @returns JSONContent[] - a flattened array of all non-paragraph nodes contained in the original paragraph
 */
function destructParagraph(paragraph: JSONContent): JSONContent[] {
  const content: JSONContent[] = [];

  if (paragraph.type === "text") {
    // wrap bare text into a paragraph, otherwise tiptap will reject it
    return [
      {
        type: "paragraph",
        content: [paragraph],
      },
    ];
  } else if (paragraph.type !== "paragraph") {
    // keep other non-paragraph nodes as is
    return [paragraph];
  }

  // destruct paragraph into all its children
  for (const inline of paragraph.content ?? []) {
    // recursively destruct each child.
    // the above conditions will ensure, that images and other are returned as is
    // while text nodes are wrapped into paragraphs and paragaphs are further destructured
    content.push(...destructParagraph(inline));
  }
  return content;
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
  // normalize cells as well as headers. headers are the cells in the head
  const normalized =
    node.type === "tableCell" || node.type === "tableHeader"
      ? normalizeTableCell(node)
      : { ...node };

  if (normalized.content) {
    normalized.content = normalized.content.map(normalizeTables);
  }

  return normalized;
}
