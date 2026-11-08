import { describe, expect, it } from "vitest";
import {
  buildDotGridBackground,
  dotDisplacement,
  dotHeight,
  dotIllumination,
  DOT_GRID_ALGORITHMS,
  DOT_GRID_FORM_ALGORITHMS,
  isFormAlgorithm,
} from "./dotGridBackground";

const decodeSvg = (image: string): string =>
  decodeURIComponent(
    image.slice('url("data:image/svg+xml,'.length, -2),
  );

const opacities = (svg: string): number[] =>
  [...svg.matchAll(/opacity="([\d.]+)"/g)].map((match) =>
    Number.parseFloat(match[1]),
  );

describe("dotGridBackground", () => {
  it("keeps every height field periodic across the tile boundary", () => {
    const cols = 12;

    for (const algorithm of DOT_GRID_ALGORITHMS) {
      for (let row = 0; row < cols; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          expect(dotHeight(algorithm, col + cols, row, cols)).toBeCloseTo(
            dotHeight(algorithm, col, row, cols),
            10,
          );
          expect(
            dotIllumination(col + cols, row, {
              algorithm,
              cols,
            }),
          ).toBeCloseTo(dotIllumination(col, row, { algorithm, cols }), 10);
        }
      }
    }
  });

  it("displaces form algorithms periodically and keeps the others on-grid", () => {
    const cols = 12;

    for (const algorithm of DOT_GRID_ALGORITHMS) {
      for (let row = 0; row < cols; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const offset = dotDisplacement(col, row, { algorithm, cols });
          const wrapped = dotDisplacement(col + cols, row, {
            algorithm,
            cols,
          });

          expect(wrapped.dx).toBeCloseTo(offset.dx, 10);
          expect(wrapped.dy).toBeCloseTo(offset.dy, 10);

          if (!isFormAlgorithm(algorithm)) {
            expect(offset).toEqual({ dx: 0, dy: 0 });
          }
        }
      }
    }
  });

  it("actually moves dots for every form algorithm", () => {
    const cols = 12;

    for (const algorithm of DOT_GRID_FORM_ALGORITHMS) {
      const offsets = [];
      for (let row = 0; row < cols; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          offsets.push(dotDisplacement(col, row, { algorithm, cols }));
        }
      }

      expect(
        offsets.some(({ dx, dy }) => Math.hypot(dx, dy) > 0.01),
      ).toBe(true);
    }
  });

  it("produces illumination in the 0..1 range", () => {
    const cols = 12;

    for (const algorithm of DOT_GRID_ALGORITHMS) {
      for (let row = 0; row < cols; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const light = dotIllumination(col, row, { algorithm, cols });
          expect(light).toBeGreaterThanOrEqual(0);
          expect(light).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("builds a deterministic, tiling SVG data URI", () => {
    const options = {
      color: "#f5f3ff",
      algorithm: "hills" as const,
    };
    const first = buildDotGridBackground(options);
    const second = buildDotGridBackground(options);

    expect(first).toEqual(second);
    expect(first.size).toBe("192px 192px");
    expect(first.image.startsWith('url("data:image/svg+xml,')).toBe(true);

    const svg = decodeSvg(first.image);
    expect(svg).toContain('width="192"');
    expect(svg.match(/<circle /g)).toHaveLength(256);
    expect(svg).toContain('fill="#f5f3ff"');
  });

  it("keeps dot opacity inside the configured min/max range", () => {
    const svg = decodeSvg(
      buildDotGridBackground({
        color: "#ffffff",
        algorithm: "peaks",
        minOpacity: 0.1,
        maxOpacity: 0.2,
      }).image,
    );

    const values = opacities(svg);
    expect(values.length).toBeGreaterThan(0);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0.1);
    expect(Math.max(...values)).toBeLessThanOrEqual(0.2);
  });

  it("uses one opacity and radius in uniform-illumination mode", () => {
    const svg = decodeSvg(
      buildDotGridBackground({
        color: "#ffffff",
        algorithm: "hills",
        uniformIllumination: true,
        uniformOpacity: 0.21,
        dotRadius: 0.6,
      }).image,
    );

    expect(new Set(opacities(svg))).toEqual(new Set([0.21]));

    const radii = [...svg.matchAll(/r="([\d.]+)"/g)].map((match) =>
      Number.parseFloat(match[1]),
    );
    expect(new Set(radii)).toEqual(new Set([0.6]));
  });

  it("renders a uniform tone for the flat algorithm", () => {
    const svg = decodeSvg(
      buildDotGridBackground({
        color: "#ffffff",
        algorithm: "flat",
        minOpacity: 0.1,
        maxOpacity: 0.2,
      }).image,
    );

    expect(new Set(opacities(svg))).toEqual(new Set([0.15]));
  });

  it("duplicates form dots that cross the tile edge", () => {
    const svg = decodeSvg(
      buildDotGridBackground({
        color: "#ffffff",
        algorithm: "swirl",
        formStrength: 2,
      }).image,
    );

    expect((svg.match(/<circle /g) ?? []).length).toBeGreaterThan(256);
  });

  it("changes the lattice when a form pattern is active", () => {
    const straight = buildDotGridBackground({
      color: "#ffffff",
      algorithm: "terrain",
      formStrength: 0,
    });
    const formed = buildDotGridBackground({
      color: "#ffffff",
      algorithm: "terrain",
      formStrength: 0.8,
    });

    expect(straight.image).not.toBe(formed.image);
  });

  it("lets the light angle change the shading", () => {
    const upperLeft = decodeSvg(
      buildDotGridBackground({
        color: "#ffffff",
        algorithm: "hills",
        lightAngle: 225,
      }).image,
    );
    const lowerRight = decodeSvg(
      buildDotGridBackground({
        color: "#ffffff",
        algorithm: "hills",
        lightAngle: 45,
      }).image,
    );

    expect(upperLeft).not.toBe(lowerRight);
  });
});
