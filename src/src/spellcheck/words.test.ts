import { describe, expect, it } from "vitest";
import { extractWordRanges } from "./words";

function words(text: string): string[] {
  return extractWordRanges(text).map((range) => range.word);
}

describe("extractWordRanges", () => {
  it("finds words with correct offsets", () => {
    expect(extractWordRanges("Hallo Welt")).toEqual([
      { word: "Hallo", from: 0, to: 5 },
      { word: "Welt", from: 6, to: 10 },
    ]);
  });

  it("keeps german umlauts and ß together", () => {
    expect(words("Grüße aus München")).toEqual([
      "Grüße",
      "aus",
      "München",
    ]);
  });

  it("trims surrounding punctuation", () => {
    expect(extractWordRanges('("Wort"),')).toEqual([
      { word: "Wort", from: 2, to: 6 },
    ]);
  });

  it("keeps inner hyphens and apostrophes", () => {
    expect(words("E-Mail doesn't")).toEqual(["E-Mail", "doesn't"]);
  });

  it("skips single letters, acronyms and numbers", () => {
    expect(words("a BMW 42 IP6")).toEqual([]);
  });

  it("skips urls and email addresses", () => {
    expect(words("see https://example.com/Path now")).toEqual([
      "see",
      "now",
    ]);
    expect(words("mail me@example.com please")).toEqual([
      "mail",
      "please",
    ]);
  });

  it("returns nothing for empty text", () => {
    expect(extractWordRanges("")).toEqual([]);
  });
});