import { describe, expect, it } from "vitest";
import { crumble, WordTooBig } from "./stringCrumbler";

/**
 * Tests for the TypeScript port of
 * https://github.com/KuramaSyu/inu/blob/main/inu/utils/string_crumbler.py
 *
 * The Python module is exercised here by mirroring its documented
 * contract — these aren't meant to lock every internal choice down,
 * just to make sure the contract the frontend relies on (length
 * cap, separator, clean-code balancing, list-in/list-out behaviour)
 * holds. If a future refactor changes any of those, update the test
 * with intent, not mechanically.
 */

const longWord = "a".repeat(1500);

describe("crumble()", () => {
  describe("basic invariants", () => {
    it("returns the input untouched when it already fits", () => {
      expect(crumble("hello world", 100)).toEqual(["hello world"]);
    });

    it("trims whitespace around each input string", () => {
      expect(crumble("   hello   ", 100)).toEqual(["hello"]);
    });

    it("returns an empty result for an empty string", () => {
      // Python's `split → packByLength` on "" would yield [""];
      // we elide empty strings so the result is `[]`. Document that
      // divergence with an explicit assertion.
      expect(crumble("", 100)).toEqual([]);
    });

    it("clamps maxLength to at least 1", () => {
      // A pathological maxLength of 0 shouldn't cause an infinite
      // loop in packByLength; we silently coerce to 1.
      const out = crumble("ab", 0);
      expect(out.length).toBeGreaterThan(0);
      for (const chunk of out) {
        expect(chunk.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("separator-driven splitting", () => {
    it("packs words greedily so each chunk ≤ maxLength", () => {
      const words = "one two three four five six seven eight nine ten";
      const out = crumble(words, 12, " ");
      expect(out.length).toBeGreaterThan(1);
      for (const chunk of out) {
        expect(chunk.length).toBeLessThanOrEqual(12);
      }
    });

    it("joins chunks with the configured separator", () => {
      const out = crumble("a-b-c-d-e-f", 3, "-");
      expect(out.join("-")).toBe("a-b-c-d-e-f");
      for (const chunk of out) {
        expect(chunk.length).toBeLessThanOrEqual(3);
      }
    });

    it("falls back to '\\n' when the explicit separator is missing", () => {
      // The input has newlines but no spaces and the user asked for
      // " " separator → auto-switch to "\n" keeps things working.
      // Each word fits in the 7-char cap, so the result should be
      // four non-empty chunks, joined as a faithful newline-joined
      // string.
      const out = crumble("alpha\nbeta\ngamma\ndelta", 7, " ");
      expect(out).toEqual(["alpha", "beta", "gamma", "delta"]);
    });

    it("throws WordTooBig when a single token exceeds maxLength", () => {
      expect(() => crumble(`small ${longWord} small`, 100, " ")).toThrow(
        WordTooBig,
      );
    });

    it("omits empty strings from the middle of a list", () => {
      // `["", "a", "", "b"]` should produce a 2-chunk list of just
      // the survivors, not four empty-ish entries.
      const out = crumble(["", "a", "", "b"], 100, " ");
      expect(out).toEqual(["a", "b"]);
    });
  });

  describe("sentence-aware fallback", () => {
    it("prefers paragraph breaks over hard cuts", () => {
      // Long enough to force at least one split, but short enough
      // that we can guess what the preferred split looks like.
      const a = "First paragraph here.";
      const b = "Second paragraph here.";
      const text = `${a}\n\n${b}`;
      const out = crumble(text, 25); // no separator → sentence mode
      expect(out.length).toBeGreaterThanOrEqual(2);
      // First chunk should end at the paragraph break, not mid-word.
      expect(out[0].endsWith("\n\n")).toBe(true);
    });

    it("falls back to a hard cut if no boundary is found", () => {
      // A single 100-char word with no breakability → must still
      // terminate, never spin forever.
      const out = crumble("x".repeat(100), 10);
      expect(out.length).toBeGreaterThan(1);
      for (const chunk of out) {
        expect(chunk.length).toBeLessThanOrEqual(10);
      }
    });

    it("returns the input when it fits, even without a separator", () => {
      expect(crumble("short text")).toEqual(["short text"]);
    });
  });

  describe("list in / list out", () => {
    it("starts a new chunk group for each input list item", () => {
      const out = crumble(["aa bb", "cc dd"], 3, " ");
      expect(out.length).toBeGreaterThanOrEqual(4);
      // The combined output should preserve both inputs verbatim.
      expect(out.join(" ")).toBe("aa bb cc dd");
    });

    it("handles an empty list without throwing", () => {
      expect(crumble([], 100)).toEqual([]);
    });
  });

  describe("code-fence balancing", () => {
    it("closes an unbalanced ``` fence at the end of a chunk", () => {
      // 10-char cap forces a single backtick-tick-tick + payload to
      // split from the closing fence.
      const input = "```\nhello";
      const out = crumble(input, 5);
      // The last chunk (the only one with an odd number of fences)
      // should now end with a closing fence.
      const last = out[out.length - 1];
      expect((last.match(/```/g) ?? []).length % 2).toBe(0);
    });

    it("leaves a balanced chunk alone", () => {
      const input = "```\na\n```";
      const out = crumble(input, 100);
      expect(out).toEqual([input]);
    });

    it("disables balancing when cleanCode: false", () => {
      const input = "```\nhello";
      const out = crumble(input, 5, undefined, { cleanCode: false });
      // The opening fence must still appear in the output — that's
      // the "we didn't add a closer" guarantee. The exact split
      // point is an implementation detail we don't lock down here.
      expect(out.join("\n").includes("```")).toBe(true);
      // Crucially: the joined output does not contain a second
      // fence, since that would mean cleanCode=false still
      // injected one.
      const fenceCount = (out.join("\n").match(/```/g) ?? []).length;
      expect(fenceCount).toBe(1);
    });
  });
});
