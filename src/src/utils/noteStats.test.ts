import { describe, expect, it } from "vitest";
import { computeStats } from "./noteStats";

// Pins the contract the metadata panel relies on:
//   - words == non-whitespace runs
//   - letters == Unicode letter count (digits/punct don't count)
//   - rows == non-empty newline-separated lines

describe("computeStats", () => {
  it("returns all-zeros for empty input", () => {
    expect(computeStats("")).toEqual({ words: 0, letters: 0, rows: 0 });
  });

  it("counts a single word on one row", () => {
    expect(computeStats("hello")).toEqual({
      words: 1,
      letters: 5,
      rows: 1,
    });
  });

  it("splits on whitespace and ignores empty runs", () => {
    expect(computeStats("a  b\tc")).toEqual({
      words: 3,
      letters: 3,
      rows: 1,
    });
  });

  it("counts each non-empty line as a row", () => {
    expect(computeStats("hello\nworld")).toEqual({
      words: 2,
      letters: 10,
      rows: 2,
    });
  });

  it("ignores blank lines between paragraphs but counts each paragraph", () => {
    // ProseMirror writes block boundaries as \n\n; the metadata panel
    // should still report one row per non-empty paragraph.
    expect(computeStats("hello\n\nworld")).toEqual({
      words: 2,
      letters: 10,
      rows: 2,
    });
  });

  it("treats a wholly blank document as zero rows", () => {
    expect(computeStats("\n\n\n")).toEqual({
      words: 0,
      letters: 0,
      rows: 0,
    });
  });

  it("does not count digits or punctuation as letters", () => {
    expect(computeStats("hi 2026!")).toEqual({
      words: 2,
      letters: 2,
      rows: 1,
    });
  });

  it("counts Unicode letters in the same way as ASCII letters", () => {
    expect(computeStats("hëllo wörld")).toEqual({
      words: 2,
      letters: 10,
      rows: 1,
    });
  });

  it("handles a single trailing newline as a single row", () => {
    expect(computeStats("hello\n")).toEqual({
      words: 1,
      letters: 5,
      rows: 1,
    });
  });
});
