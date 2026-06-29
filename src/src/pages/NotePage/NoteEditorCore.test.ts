// Tier 1 tests for the editor's pure helpers.
//
// Goal: lock in the behavior of the pure helper functions that the
// editor component depends on, so refactors of the surrounding React
// tree don't silently change the contract these helpers expose.
//
// We deliberately do NOT mount the editor component here — that's a
// Tier 4 effort. These tests are fast, free of jsdom infra, and run
// in the default `node` environment.

import { describe, expect, it } from "vitest";
import { imageLinkToBlock } from "./editorFormatUtils";

describe("imageLinkToBlock", () => {
  it("returns an HTML <img> tag in rich mode", () => {
    const url = "https://cdn.example.com/x.png";
    expect(imageLinkToBlock(url, "rich")).toBe(`<img src="${url}" />`);
  });

  it("returns a markdown image link in source mode", () => {
    const url = "https://cdn.example.com/x.png";
    expect(imageLinkToBlock(url, "source")).toBe(`![image](${url})`);
  });

  it("preserves query strings and special characters verbatim", () => {
    // `AttachmentLinkBuilder` produces URLs with width/format params.
    // We must not mangle them when handing the link off to the editor.
    const url = "https://cdn.example.com/x.png?w=720&h=480&q=80&fmt=webp";
    expect(imageLinkToBlock(url, "rich")).toBe(`<img src="${url}" />`);
    expect(imageLinkToBlock(url, "source")).toBe(`![image](${url})`);
  });

  it("does not HTML-escape characters that would break either format", () => {
    // The function is intentionally a dumb string templater. URL
    // safety is the caller's responsibility (we control the input).
    // This test pins that contract so a future refactor doesn't
    // silently start escaping & < > etc.
    const url = "https://example.com/path?<unsafe>&'\"";
    expect(imageLinkToBlock(url, "rich")).toBe(`<img src="${url}" />`);
    expect(imageLinkToBlock(url, "source")).toBe(`![image](${url})`);
  });

  it("emits the rich-mode tag with a self-closing slash and source-mode with a bang-prefix", () => {
    // Pin the exact output shapes so a careless edit to one of the
    // branches doesn't make the two modes converge on the same
    // representation (which would break the source editor's parser).
    const url = "x";
    expect(imageLinkToBlock(url, "rich")).toMatch(/^<img\s+src="x"\s+\/>$/);
    expect(imageLinkToBlock(url, "source")).toMatch(/^!\[image\]\(x\)$/);
  });
});
