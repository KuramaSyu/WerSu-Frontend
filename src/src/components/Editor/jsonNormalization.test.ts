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
