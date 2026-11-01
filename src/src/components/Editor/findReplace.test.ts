// @vitest-environment jsdom

// Pure find/replace primitives: matching, regex, whole-word, capture
// expansion and preserve-case. No editor or DOM involvement.

import { describe, expect, it } from "vitest";
import {
  buildReplacementText,
  findTextMatches,
  isFindQueryValid,
  preserveCase,
  replaceAllInText,
  type FindReplaceOptions,
} from "./findReplace";

const opts = (
  overrides: Partial<FindReplaceOptions> = {},
): FindReplaceOptions => ({
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  ...overrides,
});

describe("findTextMatches", () => {
  it("finds every literal hit, case-insensitively by default", () => {
    const matches = findTextMatches("Foo foo FOO", "foo", opts());
    expect(matches.map((m) => m.from)).toEqual([0, 4, 8]);
    expect(matches.map((m) => m.text)).toEqual(["Foo", "foo", "FOO"]);
  });

  it("honours match case", () => {
    const matches = findTextMatches("Foo foo", "foo", opts({ caseSensitive: true }));
    expect(matches).toHaveLength(1);
    expect(matches[0].from).toBe(4);
  });

  it("honours whole word", () => {
    const matches = findTextMatches(
      "foobar foo barfoo foo",
      "foo",
      opts({ wholeWord: true }),
    );
    expect(matches.map((m) => m.from)).toEqual([7, 18]);
  });

  it("supports regex with capture groups", () => {
    const matches = findTextMatches("v1.2 v3.4", "v(\\d+)\\.(\\d+)", opts({ regex: true }));
    expect(matches).toHaveLength(2);
    expect(matches[0].groups).toEqual(["1", "2"]);
  });

  it("returns nothing for an invalid regex", () => {
    const options = opts({ regex: true });
    expect(isFindQueryValid("(", options)).toBe(false);
    expect(findTextMatches("anything", "(", options)).toEqual([]);
  });
});

describe("preserveCase", () => {
  it("mirrors UPPER, lower and Capitalized", () => {
    expect(preserveCase("FOO", "bar")).toBe("BAR");
    expect(preserveCase("foo", "BAR")).toBe("bar");
    expect(preserveCase("Foo", "baz")).toBe("Baz");
  });
});

describe("buildReplacementText", () => {
  it("expands capture groups in regex mode", () => {
    const [match] = findTextMatches("v1.2", "v(\\d+)\\.(\\d+)", opts({ regex: true }));
    expect(buildReplacementText(match, "$2-$1", opts({ regex: true }))).toBe(
      "2-1",
    );
  });

  it("expands $& and $$", () => {
    const [match] = findTextMatches("foo", "foo", opts({ regex: true }));
    expect(buildReplacementText(match, "[$&]$$", opts({ regex: true }))).toBe(
      "[foo]$",
    );
  });

  it("applies preserve case after expansion", () => {
    const [match] = findTextMatches("FOO", "foo", opts());
    expect(
      buildReplacementText(match, "bar", {
        ...opts(),
        preserveCase: true,
      }),
    ).toBe("BAR");
  });
});

describe("replaceAllInText", () => {
  it("replaces every hit", () => {
    expect(replaceAllInText("a b a b", "a", "x", opts())).toBe("x b x b");
  });

  it("supports regex capture references", () => {
    expect(
      replaceAllInText(
        "v1.2 v3.4",
        "v(\\d+)\\.(\\d+)",
        "$2.$1",
        opts({ regex: true }),
      ),
    ).toBe("2.1 4.3");
  });

  it("returns the original when there is no match", () => {
    expect(replaceAllInText("abc", "zzz", "x", opts())).toBe("abc");
  });
});
