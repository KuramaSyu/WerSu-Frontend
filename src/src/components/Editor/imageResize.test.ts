import { describe, expect, it } from "vitest";

import {
  CustomWidthAutoHeightStrategy,
  parseStyleDeclarations,
  styleStringToSx,
} from "./imageResizeStrategy";
import { computeResize, geometryFromPixels } from "./imageResize";

describe("CustomWidthAutoHeightStrategy.parse", () => {
  it("parses a pixel width and drops the auto height", () => {
    expect(
      CustomWidthAutoHeightStrategy.parse("width: 320px; height: auto"),
    ).toEqual({
      width: { value: 320, unit: "px" },
      height: null,
    });
  });

  it("parses a percentage width", () => {
    expect(CustomWidthAutoHeightStrategy.parse("width: 50%")).toEqual({
      width: { value: 50, unit: "%" },
      height: null,
    });
  });

  it("parses an explicit stretched height", () => {
    expect(
      CustomWidthAutoHeightStrategy.parse(
        "width: 320px; height: 180px; border-radius: 4px",
      ),
    ).toEqual({
      width: { value: 320, unit: "px" },
      height: { value: 180, unit: "px" },
    });
  });

  it("returns null geometry for an empty style", () => {
    expect(CustomWidthAutoHeightStrategy.parse(null)).toEqual({
      width: null,
      height: null,
    });
  });
});

describe("CustomWidthAutoHeightStrategy.serialize", () => {
  it("emits width + auto height", () => {
    expect(
      CustomWidthAutoHeightStrategy.serialize({
        width: { value: 320, unit: "px" },
        height: null,
      }),
    ).toBe("width: 320px; height: auto");
  });

  it("emits a percentage width", () => {
    expect(
      CustomWidthAutoHeightStrategy.serialize({
        width: { value: 50, unit: "%" },
        height: null,
      }),
    ).toBe("width: 50%; height: auto");
  });

  it("clears the style when there is no width", () => {
    expect(
      CustomWidthAutoHeightStrategy.serialize({
        width: null,
        height: null,
      }),
    ).toBe("");
  });

  it("round-trips a previously parsed style", () => {
    const style = "width: 25%; height: auto";
    const geometry = CustomWidthAutoHeightStrategy.parse(style);
    expect(CustomWidthAutoHeightStrategy.serialize(geometry, style)).toBe(
      style,
    );
  });

  it("preserves unrelated declarations", () => {
    const style = "border: 1px solid red; width: 10px; height: auto";
    const geometry = CustomWidthAutoHeightStrategy.parse(style);
    expect(CustomWidthAutoHeightStrategy.serialize(geometry, style)).toBe(
      "border: 1px solid red; width: 10px; height: auto",
    );
  });
});

describe("CustomWidthAutoHeightStrategy.fromPixels", () => {
  it("keeps auto height when locked", () => {
    expect(
      CustomWidthAutoHeightStrategy.fromPixels({
        width: 200,
        height: 100,
        aspectRatio: 2,
        locked: true,
      }),
    ).toEqual({ width: { value: 200, unit: "px" }, height: null });
  });

  it("keeps auto height when the ratio is unchanged while unlocked", () => {
    expect(
      CustomWidthAutoHeightStrategy.fromPixels({
        width: 200,
        height: 100,
        aspectRatio: 2,
        locked: false,
      }),
    ).toEqual({ width: { value: 200, unit: "px" }, height: null });
  });

  it("persists an explicit height when stretched", () => {
    expect(
      CustomWidthAutoHeightStrategy.fromPixels({
        width: 200,
        height: 150,
        aspectRatio: 2,
        locked: false,
      }),
    ).toEqual({
      width: { value: 200, unit: "px" },
      height: { value: 150, unit: "px" },
    });
  });
});

describe("computeResize", () => {
  const base = {
    dx: 0,
    dy: 0,
    startWidth: 400,
    startHeight: 200,
    aspectRatio: 2,
    min: 24,
  };

  it("scales a locked corner uniformly", () => {
    const result = computeResize({ ...base, handle: "se", dx: 200, dy: 0, locked: true });
    expect(result.width).toBeCloseTo(600);
    expect(result.height).toBeCloseTo(300);
  });

  it("stretches an unlocked corner on both axes", () => {
    const result = computeResize({ ...base, handle: "se", dx: 100, dy: 50, locked: false });
    expect(result.width).toBeCloseTo(500);
    expect(result.height).toBeCloseTo(250);
  });

  it("scales the other axis for a locked edge handle", () => {
    const result = computeResize({ ...base, handle: "e", dx: 200, dy: 0, locked: true });
    expect(result.width).toBeCloseTo(600);
    expect(result.height).toBeCloseTo(300);
  });

  it("stretches only one axis for an unlocked edge handle", () => {
    const result = computeResize({ ...base, handle: "e", dx: 200, dy: 0, locked: false });
    expect(result.width).toBeCloseTo(600);
    expect(result.height).toBeCloseTo(200);
  });

  it("never goes below the minimum", () => {
    const result = computeResize({ ...base, handle: "e", dx: -10_000, dy: 0, locked: false });
    expect(result.width).toBe(24);
  });
});

describe("helpers", () => {
  it("parses declarations and trims", () => {
    expect(parseStyleDeclarations(" width : 10px ; height:auto ")).toEqual([
      ["width", "10px"],
      ["height", "auto"],
    ]);
  });

  it("converts a style string to sx keys", () => {
    expect(styleStringToSx("border-radius: 4px; width: 10px")).toEqual({
      borderRadius: "4px",
      width: "10px",
    });
  });

  it("builds pixel geometry through the strategy", () => {
    expect(
      geometryFromPixels(
        CustomWidthAutoHeightStrategy,
        { width: 100, height: 200, aspectRatio: 0.5 },
        false,
      ),
    ).toEqual({
      width: { value: 100, unit: "px" },
      height: null,
    });
  });
});
