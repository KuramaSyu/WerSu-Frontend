import { describe, expect, it } from "vitest";
import { normalizeTableCell, normalizeTables } from "./jsonNormalization";

describe("normalizeTableCell", () => {
  it("extracts image from paragraph", () => {
    const input = {
      type: "tableCell",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                src: "/image.png",
              },
            },
            {
              type: "text",
              text: "Hello",
            },
          ],
        },
      ],
    };

    expect(normalizeTableCell(input)).toEqual({
      type: "tableCell",
      content: [
        {
          attrs: {
            src: "/image.png",
          },
          type: "image",
        },
        {
          content: [
            {
              type: "text",
              text: "Hello",
            },
          ],
          type: "paragraph",
        },
      ],
    });
  });

  it("keeps image-only paragraph as image", () => {
    const input = {
      type: "tableCell",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                src: "/image.png",
              },
            },
          ],
        },
      ],
    };

    expect(normalizeTableCell(input)).toEqual({
      type: "tableCell",
      content: [
        {
          type: "image",
          attrs: {
            src: "/image.png",
          },
        },
      ],
    });
  });

  it("keeps normal paragraphs unchanged", () => {
    const input = {
      type: "tableCell",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Hello",
            },
          ],
        },
      ],
    };

    expect(normalizeTableCell(input)).toEqual(input);
  });

  // Regression for the <br/> in cell bug: destructParagraph used to
  // flatten every paragraph into its inlines, which made the cell
  // multi-child and let `extension-table`'s renderTableToMarkdown leak
  // the U+001F cell-line separator into the cell text. Inline-only
  // paragraphs (text + hardBreak) must stay intact so the cell stays
  // a single child and the round-trip stays clean.
  it("keeps paragraphs with a hardBreak intact (no leak on <br/>)", () => {
    const input = {
      type: "tableCell",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "line one" },
            { type: "hardBreak" },
            { type: "text", text: "line two" },
          ],
        },
      ],
    };

    expect(normalizeTableCell(input)).toEqual(input);
  });
});

describe("normalizeTables", () => {
  it("normalizes nested table cells recursively", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "image",
                          attrs: {
                            src: "/image.png",
                          },
                        },
                        {
                          type: "text",
                          text: "Hello",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = normalizeTables(doc);

    expect(result.content?.[0].content?.[0].content?.[0]).toEqual({
      type: "tableCell",
      content: [
        {
          type: "image",
          attrs: {
            src: "/image.png",
          },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Hello",
            },
          ],
        },
      ],
    });
  });

  it("keeps the arrangement of text an image as is after destruction", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: "Hello1",
                        },
                        {
                          type: "image",
                          attrs: {
                            src: "/image.png",
                          },
                        },
                        {
                          type: "text",
                          text: "Hello2",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = normalizeTables(doc);
    expect(result.content?.[0].content?.[0].content?.[0]).toEqual({
      type: "tableCell",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Hello1",
            },
          ],
        },
        {
          type: "image",
          attrs: {
            src: "/image.png",
          },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Hello2",
            },
          ],
        },
      ],
    });
  });
});
