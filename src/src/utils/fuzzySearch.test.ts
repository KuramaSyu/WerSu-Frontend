import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "./fuzzySearch";

describe("fuzzyMatch()", () => {
  it("returns null for an empty query", () => {
    expect(fuzzyMatch("", "anything")).toBeNull();
    expect(fuzzyMatch("   ", "anything")).toBeNull();
  });

  it("returns null when the query is not a subsequence", () => {
    expect(fuzzyMatch("xyz", "abc")).toBeNull();
    expect(fuzzyMatch("ba", "ab")).toBeNull();
  });

  it("matches a case-insensitive subsequence and reports indices", () => {
    const match = fuzzyMatch("rd", "readme");
    expect(match).not.toBeNull();
    expect(match?.indices).toEqual([0, 3]);
  });

  it("scores consecutive matches above scattered ones", () => {
    const consecutive = fuzzyMatch("abc", "abc");
    const scattered = fuzzyMatch("abc", "a-b-c");
    expect(consecutive).not.toBeNull();
    expect(scattered).not.toBeNull();
    expect(consecutive!.score).toBeGreaterThan(scattered!.score);
  });

  it("rewards word-boundary matches", () => {
    const boundary = fuzzyMatch("project", "my project notes");
    const inside = fuzzyMatch("project", "myprojectnotes");
    expect(boundary).not.toBeNull();
    expect(inside).not.toBeNull();
    expect(boundary!.score).toBeGreaterThan(inside!.score);
  });
});
