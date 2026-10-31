import { describe, expect, it } from "vitest";
import { normalizeImageUrl } from "./imageUrl";

describe("normalizeImageUrl", () => {
  it("rewrites GitHub raw URLs to raw.githubusercontent.com", () => {
    expect(
      normalizeImageUrl(
        "https://github.com/linuxserver/.github/raw/main/branding/logos/Linuxserver-Logo-RGB.png",
      ),
    ).toBe(
      "https://raw.githubusercontent.com/linuxserver/.github/main/branding/logos/Linuxserver-Logo-RGB.png",
    );
  });

  it("rewrites GitHub blob page URLs to the raw asset", () => {
    expect(
      normalizeImageUrl("https://github.com/o/r/blob/main/img/logo.png"),
    ).toBe("https://raw.githubusercontent.com/o/r/main/img/logo.png");
  });

  it("handles www.github.com", () => {
    expect(
      normalizeImageUrl("https://www.github.com/o/r/raw/v1/a/b.png"),
    ).toBe("https://raw.githubusercontent.com/o/r/v1/a/b.png");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeImageUrl("  https://example.com/a.png  ")).toBe(
      "https://example.com/a.png",
    );
  });

  it("leaves non-GitHub URLs unchanged", () => {
    expect(normalizeImageUrl("https://example.com/a.png")).toBe(
      "https://example.com/a.png",
    );
  });

  it("leaves GitHub URLs that are not raw/blob assets unchanged", () => {
    expect(normalizeImageUrl("https://github.com/o/r/issues/1")).toBe(
      "https://github.com/o/r/issues/1",
    );
  });

  it("returns empty and invalid input unchanged", () => {
    expect(normalizeImageUrl("")).toBe("");
    expect(normalizeImageUrl("not a url")).toBe("not a url");
  });
});
