import { describe, expect, it } from "vitest";
import {
  DIRECTORY_HEADER_IMAGE_ALT,
  NOTE_HEADER_IMAGE_ALT,
  buildHeaderImageMarkdown,
  composeNoteContent,
  extractImageUrl,
  findDirectoryHeaderImage,
  findNoteHeaderImage,
  removeHeaderImage,
  stripNoteHeaderImage,
  upsertNoteHeaderImage,
} from "./headerImage";

const noteWithHeader = [
  "![HeaderImage](https://example.com/header.png)",
  "",
  "# Body",
  "",
  "Some prose",
].join("\n");

describe("findNoteHeaderImage", () => {
  it("finds a HeaderImage in the first lines", () => {
    expect(findNoteHeaderImage(noteWithHeader)).toMatchObject({
      alt: "HeaderImage",
      url: "https://example.com/header.png",
      lineIndex: 0,
    });
  });

  it("ignores an image with a different alt", () => {
    expect(
      findNoteHeaderImage("![cover](https://example.com/cover.png)"),
    ).toBeNull();
  });

  it("ignores a HeaderImage below the first 10 lines", () => {
    const content = [
      ...Array.from({ length: 10 }, () => "filler line"),
      "![HeaderImage](https://example.com/late.png)",
    ].join("\n");
    expect(findNoteHeaderImage(content)).toBeNull();
  });

  it("is case-insensitive on the alt", () => {
    expect(
      findNoteHeaderImage("[headerimage](https://example.com/x.png)"),
    ).toBeNull();
    expect(
      findNoteHeaderImage("![headerimage](https://example.com/x.png)"),
    ).toMatchObject({ url: "https://example.com/x.png" });
  });
});

describe("findDirectoryHeaderImage", () => {
  it("finds the bookImage alt used by the README", () => {
    expect(
      findDirectoryHeaderImage("![bookImage](https://example.com/cover.png)"),
    ).toMatchObject({ url: "https://example.com/cover.png" });
  });
});

describe("extractImageUrl", () => {
  it("extracts the URL from an attachment link", () => {
    expect(
      extractImageUrl(
        "![Attachment Image](/api/attachments/image?key=abc&width=720)",
      ),
    ).toBe("/api/attachments/image?key=abc&width=720");
  });

  it("returns null for non-image input", () => {
    expect(extractImageUrl("not an image")).toBeNull();
  });
});

describe("stripNoteHeaderImage", () => {
  it("removes the header and keeps the body", () => {
    expect(stripNoteHeaderImage(noteWithHeader)).toBe("# Body\n\nSome prose");
  });

  it("only strips the leading header, not a body image", () => {
    const content = [
      "Body intro",
      ...Array.from({ length: 10 }, () => "filler"),
      "![HeaderImage](https://example.com/body.png)",
    ].join("\n");
    expect(stripNoteHeaderImage(content)).toBe(content);
  });
});

describe("upsertNoteHeaderImage", () => {
  it("prepends a header when none exists", () => {
    expect(upsertNoteHeaderImage("# Body", "https://example.com/x.png")).toBe(
      `![${NOTE_HEADER_IMAGE_ALT}](https://example.com/x.png)\n\n# Body`,
    );
  });

  it("replaces an existing header in place", () => {
    expect(
      upsertNoteHeaderImage(noteWithHeader, "https://example.com/new.png"),
    ).toBe(
      [
        "![HeaderImage](https://example.com/new.png)",
        "",
        "# Body",
        "",
        "Some prose",
      ].join("\n"),
    );
  });

  it("keeps leading blank lines out of the way", () => {
    expect(
      upsertNoteHeaderImage("\n\n# Body", "https://example.com/x.png"),
    ).toBe(`${buildHeaderImageMarkdown("https://example.com/x.png", NOTE_HEADER_IMAGE_ALT)}\n\n# Body`);
  });
});

describe("removeHeaderImage", () => {
  it("is a no-op when there is no header", () => {
    expect(removeHeaderImage("# Body", "HeaderImage")).toBe("# Body");
  });

  it("removes a directory header", () => {
    expect(
      removeHeaderImage(
        `![${DIRECTORY_HEADER_IMAGE_ALT}](https://example.com/c.png)\n\n# Book`,
        DIRECTORY_HEADER_IMAGE_ALT,
      ),
    ).toBe("# Book");
  });
});

describe("composeNoteContent", () => {
  it("re-attaches the header above the body", () => {
    expect(
      composeNoteContent(
        "# Body\n\nProse",
        "![HeaderImage](https://example.com/h.png)",
      ),
    ).toBe(
      "![HeaderImage](https://example.com/h.png)\n\n# Body\n\nProse",
    );
  });

  it("returns just the body when there is no header", () => {
    expect(composeNoteContent("# Body", null)).toBe("# Body");
  });

  it("returns just the header when the body is empty", () => {
    expect(
      composeNoteContent("", "![HeaderImage](https://example.com/h.png)"),
    ).toBe("![HeaderImage](https://example.com/h.png)");
  });

  it("does not duplicate a header already in the body", () => {
    expect(
      composeNoteContent(
        noteWithHeader,
        "![HeaderImage](https://example.com/header.png)",
      ),
    ).toBe(
      "![HeaderImage](https://example.com/header.png)\n\n# Body\n\nSome prose",
    );
  });
});
