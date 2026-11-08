/**
 * Procedural dot-grid texture used behind the outlet when the active theme
 * has no background image.
 *
 * Each algorithm defines a periodic height field. The dot illumination is
 * then derived from that field: finite differences give the surface normal,
 * which is lit by a configurable directional light (Lambert term). Because
 * every field repeats on the tile boundary, the generated SVG tiles
 * seamlessly.
 */

const TAU = Math.PI * 2;

/** Algorithm ids are persisted in appearance settings; keep them stable. */
export const DOT_GRID_ALGORITHMS = [
  "hills",
  "peaks",
  "dunes",
  "ripples",
  "waves",
  "flat",
  "terrain",
  "swirl",
  "warp",
] as const;

export type DotGridAlgorithm = (typeof DOT_GRID_ALGORITHMS)[number];

/** Algorithms that also displace the dots, not just their illumination. */
export const DOT_GRID_FORM_ALGORITHMS = [
  "terrain",
  "swirl",
  "warp",
] as const;

export const isFormAlgorithm = (
  algorithm: DotGridAlgorithm,
): boolean =>
  (DOT_GRID_FORM_ALGORITHMS as readonly string[]).includes(algorithm);

interface Hill {
  /** Centre in normalised tile coordinates (0..1). */
  x: number;
  y: number;
  amplitude: number;
  /** Standard deviation as a fraction of the tile size. */
  sigma: number;
}

/**
 * A handful of overlapping Gaussian hills. Torus-wrapped distances keep the
 * field continuous across the tile seam.
 */
const HILLS: readonly Hill[] = [
  { x: 0.18, y: 0.2, amplitude: 1.0, sigma: 0.2 },
  { x: 0.68, y: 0.14, amplitude: 0.7, sigma: 0.14 },
  { x: 0.4, y: 0.6, amplitude: 0.9, sigma: 0.22 },
  { x: 0.82, y: 0.68, amplitude: 0.8, sigma: 0.16 },
  { x: 0.1, y: 0.86, amplitude: 0.6, sigma: 0.13 },
];

interface Ripple {
  x: number;
  y: number;
  amplitude: number;
  /** Rings between the centre and the antipodal point. */
  frequency: number;
  falloff: number;
}

const RIPPLES: readonly Ripple[] = [
  { x: 0.3, y: 0.34, amplitude: 1.0, frequency: 5, falloff: 1.4 },
  { x: 0.74, y: 0.68, amplitude: 0.65, frequency: 7, falloff: 2.2 },
];

/**
 * Per-algorithm gradient gains. The raw fields have very different slopes
 * (a broad Gaussian hill is much flatter than an interference wave), so
 * normalising here keeps the shared `relief` slider meaningful across every
 * pattern instead of making some algorithms look flat and others extreme.
 */
const ALGORITHM_GAIN: Readonly<Record<DotGridAlgorithm, number>> = {
  hills: 5,
  peaks: 2.5,
  dunes: 1.4,
  ripples: 1.3,
  waves: 1.3,
  flat: 1,
  terrain: 5,
  swirl: 1.3,
  warp: 1.4,
};

function dunesHeight(col: number, row: number, cols: number): number {
  const u = (col / cols) * TAU;
  const v = (row / cols) * TAU;
  return (
    Math.sin(u * 2 + v) * 0.55 +
    Math.sin(u - v * 3 + 1.2) * 0.3 +
    Math.sin(u * 4 + v * 2 + 0.4) * 0.15
  );
}

function wavesHeight(col: number, row: number, cols: number): number {
  const u = (col / cols) * TAU;
  const v = (row / cols) * TAU;
  return (
    Math.sin(u * 2 + v) * 0.5 +
    Math.sin(u * 3 - v * 2 + 1.7) * 0.3 +
    Math.cos(u + v * 4) * 0.2
  );
}

/** Shortest signed distance between two cells on a wrapped axis. */
function wrappedDelta(delta: number, size: number): number {
  const wrapped = ((delta % size) + size) % size;
  return wrapped > size / 2 ? wrapped - size : wrapped;
}

function gaussianHills(
  col: number,
  row: number,
  cols: number,
  sharpness: number,
): number {
  let height = 0;

  for (const hill of HILLS) {
    const dx = wrappedDelta(col - hill.x * cols, cols);
    const dy = wrappedDelta(row - hill.y * cols, cols);
    const sigma = Math.max(0.55, hill.sigma * cols * sharpness);
    height +=
      hill.amplitude * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
  }

  return height;
}

function ripplesHeight(col: number, row: number, cols: number): number {
  let height = 0;

  for (const ripple of RIPPLES) {
    const dx = wrappedDelta(col - ripple.x * cols, cols) / cols;
    const dy = wrappedDelta(row - ripple.y * cols, cols) / cols;
    const distance = Math.hypot(dx, dy);
    height +=
      ripple.amplitude *
      Math.cos(distance * TAU * ripple.frequency) *
      Math.exp(-distance * ripple.falloff);
  }

  return height;
}

/**
 * Height of the selected procedural surface at dot `(col, row)`.
 * Exported for tests: every algorithm must be periodic in `cols`.
 */
export function dotHeight(
  algorithm: DotGridAlgorithm,
  col: number,
  row: number,
  cols: number,
): number {
  switch (algorithm) {
    case "hills":
    case "terrain":
      return gaussianHills(col, row, cols, 1);
    case "peaks":
      return gaussianHills(col, row, cols, 0.55);
    case "dunes":
    case "warp":
      return dunesHeight(col, row, cols);
    case "ripples":
      return ripplesHeight(col, row, cols);
    case "waves":
    case "swirl":
      return wavesHeight(col, row, cols);
    case "flat":
    default:
      return 0;
  }
}

export interface DotGridIlluminationOptions {
  algorithm: DotGridAlgorithm;
  /** Dots per tile edge. */
  cols: number;
  /** Gradient exaggeration; higher values make the relief more dramatic. */
  relief?: number;
  /** Light direction in degrees (225 = from the upper-left). */
  lightAngle?: number;
}

/**
 * Diffuse illumination (0..1) for a dot: finite-difference gradient of the
 * height field -> surface normal -> Lambert term against the configured
 * light direction.
 *
 * Neighbours wrap around the tile, so the lighting is periodic too and the
 * generated SVG can repeat without visible seams.
 */
export function dotIllumination(
  col: number,
  row: number,
  {
    algorithm,
    cols,
    relief = 1,
    lightAngle = 225,
  }: DotGridIlluminationOptions,
): number {
  if (algorithm === "flat") {
    return 0.5;
  }

  const wrap = (value: number): number => ((value % cols) + cols) % cols;

  const left = dotHeight(algorithm, wrap(col - 1), row, cols);
  const right = dotHeight(algorithm, wrap(col + 1), row, cols);
  const up = dotHeight(algorithm, col, wrap(row - 1), cols);
  const down = dotHeight(algorithm, col, wrap(row + 1), cols);

  const gain = relief * ALGORITHM_GAIN[algorithm];
  const nx = (left - right) * gain;
  const ny = (up - down) * gain;
  const nz = 1;

  const angle = (lightAngle * Math.PI) / 180;
  const lx = Math.cos(angle);
  const ly = Math.sin(angle);
  const lz = 0.9;

  const normalLength = Math.hypot(nx, ny, nz);
  const lightLength = Math.hypot(lx, ly, lz);
  const lambert =
    (nx * lx + ny * ly + nz * lz) / (normalLength * lightLength);

  // Remap [-1, 1] to [0, 1] instead of clamping. Clamping would turn whole
  // patches into identical "fully in shadow" dots, which reads as holes
  // rather than relief; the remap keeps every dot on the gradient.
  return 0.5 + 0.5 * lambert;
}

export interface DotGridDisplacementOptions {
  algorithm: DotGridAlgorithm;
  cols: number;
  /** Displacement amplitude in dot cells. 0 disables the form effect. */
  formStrength?: number;
}

/**
 * Position offset for form algorithms, in dot cells (the caller multiplies
 * by the spacing). Every field is periodic on the tile so displaced dots
 * still wrap seamlessly; the builder duplicates dots near the tile edge so
 * circles crossing the seam are not clipped.
 */
export function dotDisplacement(
  col: number,
  row: number,
  { algorithm, cols, formStrength = 0.8 }: DotGridDisplacementOptions,
): { dx: number; dy: number } {
  if (!isFormAlgorithm(algorithm)) {
    return { dx: 0, dy: 0 };
  }

  const u = (col / cols) * TAU;
  const v = (row / cols) * TAU;

  switch (algorithm) {
    case "terrain": {
      const wrap = (value: number): number => ((value % cols) + cols) % cols;
      const left = gaussianHills(wrap(col - 1), row, cols, 1);
      const right = gaussianHills(wrap(col + 1), row, cols, 1);
      const up = gaussianHills(col, wrap(row - 1), cols, 1);
      const down = gaussianHills(col, wrap(row + 1), cols, 1);
      // Slide downhill (against the gradient) so dots bunch in valleys and
      // spread over the crowns, making the hills readable as terrain.
      return {
        dx: -((right - left) / 2) * formStrength,
        dy: -((down - up) / 2) * formStrength,
      };
    }
    case "swirl":
      return {
        dx: (Math.sin(v) + 0.35 * Math.sin(2 * u + v)) * formStrength,
        dy: (-Math.sin(u) + 0.35 * Math.cos(u - 2 * v)) * formStrength,
      };
    case "warp":
      return {
        dx: (Math.sin(2 * u + v) + 0.4 * Math.cos(u - 2 * v)) * formStrength,
        dy: (Math.cos(3 * u - v) + 0.4 * Math.sin(2 * u + 3 * v)) *
          formStrength,
      };
    default:
      return { dx: 0, dy: 0 };
  }
}

export interface DotGridOptions {
  /** Dot fill colour (usually the theme's primary text colour). */
  color: string;
  algorithm?: DotGridAlgorithm;
  /** Distance between dot centres in CSS pixels. */
  spacing?: number;
  /** Opacity for the darkest dots. */
  minOpacity?: number;
  /** Opacity for the brightest dots. */
  maxOpacity?: number;
  /** Light direction in degrees. */
  lightAngle?: number;
  /** Gradient exaggeration. */
  relief?: number;
  /** Base dot radius in CSS pixels. */
  dotRadius?: number;
  /** Displacement amplitude for form algorithms, in dot cells. */
  formStrength?: number;
  /** Use one opacity for every dot instead of the min/max range. */
  uniformIllumination?: boolean;
  /** Opacity used when `uniformIllumination` is true. */
  uniformOpacity?: number;
  /** Preferred tile edge in CSS pixels; actual size is snapped to the grid. */
  targetTile?: number;
}

export interface DotGridBackground {
  /** CSS `background-image` value (an encoded SVG data URI). */
  image: string;
  /** Matching CSS `background-size` value. */
  size: string;
}

export function buildDotGridBackground({
  color,
  algorithm = "hills",
  spacing = 12,
  minOpacity = 0.06,
  maxOpacity = 0.28,
  lightAngle = 225,
  relief = 1.8,
  dotRadius = 0.7,
  formStrength = 0.8,
  uniformIllumination = false,
  uniformOpacity = 0.16,
  targetTile = 192,
}: DotGridOptions): DotGridBackground {
  // Snap the tile to the dot grid so the SVG repeats exactly. The target
  // keeps the hill scale roughly constant when only the spacing changes.
  const cols = Math.max(4, Math.round(targetTile / spacing));
  const tile = cols * spacing;
  const darkest = Math.min(minOpacity, maxOpacity);
  const brightest = Math.max(minOpacity, maxOpacity);
  const flatOpacity = Math.max(0, Math.min(1, uniformOpacity));
  const maxRadius = dotRadius * 1.2 + 0.05;
  const circles: string[] = [];

  const wrap = (value: number): number => ((value % tile) + tile) % tile;
  // A dot whose circle crosses the tile edge needs a copy on the opposite
  // edge, otherwise the repeated tile shows a clipped notch.
  const edgeCopies = (value: number): number[] => {
    const copies = [value];
    if (value < maxRadius) {
      copies.push(value + tile);
    }
    if (value > tile - maxRadius) {
      copies.push(value - tile);
    }
    return copies;
  };

  for (let row = 0; row < cols; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const light = uniformIllumination
        ? 0.5
        : dotIllumination(col, row, {
            algorithm,
            cols,
            relief,
            lightAngle,
          });
      const displacement = dotDisplacement(col, row, {
        algorithm,
        cols,
        formStrength,
      });
      const opacity = uniformIllumination
        ? flatOpacity
        : darkest + (brightest - darkest) * light;
      // Uniform mode also keeps the dot size constant; only form patterns
      // are allowed to move the dots around.
      const radius = uniformIllumination
        ? dotRadius
        : dotRadius * (0.8 + 0.4 * light);
      const baseX = (col + 0.5) * spacing + displacement.dx * spacing;
      const baseY = (row + 0.5) * spacing + displacement.dy * spacing;
      const cx = wrap(baseX);
      const cy = wrap(baseY);

      for (const x of edgeCopies(cx)) {
        for (const y of edgeCopies(cy)) {
          circles.push(
            `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" fill="${color}" opacity="${opacity.toFixed(3)}"/>`,
          );
        }
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}" viewBox="0 0 ${tile} ${tile}">${circles.join("")}</svg>`;

  return {
    image: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    size: `${tile}px ${tile}px`,
  };
}
