import { describe, expect, it } from "vitest";
import {
  generatePublicUserName,
  displayInitials,
  PUBLIC_USER_ADJECTIVES,
  PUBLIC_USER_OBJECTS,
} from "./publicUserName";

/**
 * Pins the contracts the collab caret relies on:
 *   - the generator always returns "<word> <word>"
 *   - both words start with the same letter (alliteration)
 *   - both words are taken from the exported lists
 *   - the lists are big enough that "confused koala" / "bad bear"
 *     style names are reachable (sanity check on shared letters)
 */

describe("generatePublicUserName()", () => {
  it("returns two lowercase words separated by a single space", () => {
    const name = generatePublicUserName();
    const parts = name.split(" ");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[a-z]+$/);
    expect(parts[1]).toMatch(/^[a-z]+$/);
  });

  it("returns an alliterative name (same first letter)", () => {
    for (let i = 0; i < 50; i++) {
      const name = generatePublicUserName();
      const [adj, obj] = name.split(" ");
      expect(adj[0]).toBe(obj[0]);
    }
  });

  it("only picks words from the exported adjective and object lists", () => {
    for (let i = 0; i < 50; i++) {
      const [adj, obj] = generatePublicUserName().split(" ");
      expect(PUBLIC_USER_ADJECTIVES).toContain(adj);
      expect(PUBLIC_USER_OBJECTS).toContain(obj);
    }
  });

  it("produces varied names across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(generatePublicUserName());
    }
    // 50 calls should easily yield more than a handful of unique
    // names given the list sizes; a low cap here would catch a
    // regression that accidentally collapses to a single letter.
    expect(seen.size).toBeGreaterThan(10);
  });
});

describe("public-user word lists", () => {
  it("adjective list has no duplicates and is reasonably big", () => {
    expect(PUBLIC_USER_ADJECTIVES.length).toBeGreaterThan(50);
    expect(new Set(PUBLIC_USER_ADJECTIVES).size).toBe(
      PUBLIC_USER_ADJECTIVES.length,
    );
  });

  it("object list has no duplicates and is reasonably big", () => {
    expect(PUBLIC_USER_OBJECTS.length).toBeGreaterThan(50);
    expect(new Set(PUBLIC_USER_OBJECTS).size).toBe(PUBLIC_USER_OBJECTS.length);
  });
});

describe("displayInitials()", () => {
  it("takes the first letter of each of the first two words", () => {
    expect(displayInitials("confused koala")).toBe("CK");
    expect(displayInitials("alice cooper")).toBe("AC");
    expect(displayInitials("bad bear")).toBe("BB");
  });

  it("ignores words past the second", () => {
    expect(displayInitials("alice cooper smith")).toBe("AC");
  });

  it("takes the first two letters when there is only one word", () => {
    expect(displayInitials("alice")).toBe("AL");
    expect(displayInitials("Al")).toBe("AL");
    expect(displayInitials("Z")).toBe("Z");
  });

  it("uppercases the result", () => {
    expect(displayInitials("alice cooper")).toBe("AC");
  });

  it("falls back to '?' for empty or whitespace-only input", () => {
    expect(displayInitials("")).toBe("?");
    expect(displayInitials("   ")).toBe("?");
    expect(displayInitials(undefined)).toBe("?");
  });

  it("treats extra whitespace as a single separator", () => {
    expect(displayInitials("confused   koala")).toBe("CK");
    expect(displayInitials("  confused koala  ")).toBe("CK");
  });
});
