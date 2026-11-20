/**
 * Spiral geometry for `DocumentSwirl`.
 *
 * Pure math + a small cache, deliberately free of React and animation
 * imports so it can be shared by the lean swirl component and by the
 * lazily-loaded extras chunk without creating a cycle between them.
 *
 * Everything lives in a 0..100 coordinate space; the caller scales it to
 * whatever the screen needs.
 */

// Spiral geometry (all in the 0..100 coordinate space)
// ---------------------------------------------------------------------------

/** Innermost radius of the ribbon, in the 0..100 stage coordinate space. */
const R_INNER = 4;
/**
 * Outermost radius. It deliberately reaches past the visible area: the
 * stage is scaled so this tip always ends up off screen (see the layout
 * measuring effect in `DocumentSwirl`), which is what hides the flat cut
 * at the end of the ribbon.
 */
export const R_OUTER = 55;

/**
 * Deterministic pseudo-random in [0, 1) derived from a numeric seed.
 * Using a seeded value instead of `Math.random()` keeps an element's
 * "random" look stable across renders and geometry rebuilds (so notes
 * don't jump when the window is resized).
 */
export const rand = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Always-positive modulo, so angles wrap cleanly even for negatives. */
export const mod = (value: number, range: number): number =>
  ((value % range) + range) % range;

/**
 * Everything derived from the total number of turns. Built once per
 * screen-size bucket and passed down to the notes/pulses/bursts.
 */
export interface Geometry {
  /** Angle where the ribbon begins (kept just off zero to avoid a seam). */
  thetaMin: number;
  /** Angle where the ribbon ends, i.e. `turns * 2π`. */
  thetaMax: number;
  /** Distance from centre at a given angle, including the wobble. */
  radius: (theta: number) => number;
  /** Ribbon thickness at a given angle, in stage units. */
  thickness: (theta: number) => number;
  /** X coordinate (0..100) of the ribbon at a given angle. */
  posX: (theta: number) => number;
  /** Y coordinate (0..100) of the ribbon at a given angle. */
  posY: (theta: number) => number;
  /** Direction of travel along the ribbon at a given angle, in degrees. */
  tangentDeg: (theta: number) => number;
  /** Fold an angle back into the visible [thetaMin, thetaMax) window. */
  wrapTheta: (value: number) => number;
  /** SVG path for the filled ribbon (used as the visible line). */
  ribbonPath: string;
}

/**
 * How many total turns the ribbon makes. The stage is scaled to the
 * screen, so this is what actually controls how many spins are visible:
 * mobile gets roughly one fewer, big displays get more.
 */
export const computeTurns = (vw: number, vh: number): number => {
  const minSide = Math.min(vw, vh);
  return 3.3 + Math.max(0, Math.min(2.3, (minSide - 400) / 330));
};

const buildGeometry = (turns: number): Geometry => {
  // Angular span of the whole ribbon and its growth rate per radian.
  // `k` is chosen so the radius hits exactly R_OUTER at thetaMax.
  const thetaMax = turns * Math.PI * 2;
  const thetaMin = 0.6;
  const k = (R_OUTER - R_INNER) / thetaMax;

  /** Centre of the spiral, in the 0..100 coordinate space. */
  const CENTER = 50;

  // Hand-drawn wobble: a sum of low-frequency sines added radially. The
  // taper forces it to zero at both ends so the inner start is clean and
  // the outer tip sits at exactly R_OUTER (guaranteeing it stays hidden).
  const bump = (theta: number): number => {
    const raw =
      0.055 * Math.sin(theta * 1.7 + 0.6) +
      0.04 * Math.sin(theta * 3.1 + 2.2) +
      0.03 * Math.sin(theta * 5.3 + 1.1) +
      0.022 * Math.sin(theta * 8.9 + 4.4);
    const t = theta / thetaMax;
    const taper = Math.max(0, Math.min(t / 0.07, (1 - t) / 0.1, 1));
    return raw * taper;
  };

  // Archimedean base radius plus the wobble (so the line bulges a little).
  const radius = (theta: number): number =>
    (R_INNER + k * theta) * (1 + bump(theta));

  // Thickness (in 0..100 units) that swells and pinches along the line.
  // Three incommensurate sines keep the pattern from repeating legibly.
  const thickness = (theta: number): number =>
    0.18 +
    0.38 * (0.5 + 0.5 * Math.sin(theta * 2.4 + 0.3)) +
    0.22 * (0.5 + 0.5 * Math.sin(theta * 4.7 + 2.0)) +
    0.14 * (0.5 + 0.5 * Math.sin(theta * 7.9 + 5.0));

  // Point on the ribbon centreline at a given angle.
  const posX = (theta: number): number =>
    CENTER + radius(theta) * Math.cos(theta);
  const posY = (theta: number): number =>
    CENTER + radius(theta) * Math.sin(theta);

  // Direction of travel: estimated with a tiny finite difference of the
  // centreline, which stays correct even with the wobble applied.
  const tangentDeg = (theta: number): number => {
    const d = 0.02;
    const dx = posX(theta + d) - posX(theta - d);
    const dy = posY(theta + d) - posY(theta - d);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  // Fold an arbitrary angle back into the ribbon's window (used for the
  // looping motion of notes/pulses/coffee).
  const wrapTheta = (value: number): number =>
    thetaMin + mod(value - thetaMin, thetaMax - thetaMin);

  // Build the ribbon as one closed shape: walk the outer edge outward,
  // then the inner edge back, and fill between them. The sample count and
  // two decimal places per coordinate are deliberately generous: the
  // ribbon is only ~0.2 stage units thick at its inner start, so coarser
  // rounding or sampling shows up as a visibly stair-stepped edge right
  // where the logo sits. Sizing the path down is not worth that — the
  // build is cached and the raster happens once.
  const steps = Math.min(2200, Math.max(900, Math.round(thetaMax * 60)));
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const theta = (i / steps) * thetaMax;
    const r = radius(theta);
    const w = thickness(theta) / 2;
    const ro = r + w;
    const ri = Math.max(0.4, r - w);
    outer.push(
      `${(CENTER + ro * Math.cos(theta)).toFixed(2)} ${(
        CENTER +
        ro * Math.sin(theta)
      ).toFixed(2)}`,
    );
    inner.push(
      `${(CENTER + ri * Math.cos(theta)).toFixed(2)} ${(
        CENTER +
        ri * Math.sin(theta)
      ).toFixed(2)}`,
    );
  }
  inner.reverse();
  const ribbonPath = `M${outer.join(" L")} L${inner.join(" L")} Z`;

  return {
    thetaMin,
    thetaMax,
    radius,
    thickness,
    posX,
    posY,
    tangentDeg,
    wrapTheta,
    ribbonPath,
  };
};

/**
 * Geometry cache. `buildGeometry` walks the whole ribbon and emits a big
 * path string (~50 KB), so it is worth not rebuilding it when the
 * component remounts (route changes, StrictMode double-mount) or when a
 * resize lands in the same size bucket.
 *
 * The turn count is quantised before it is used as the key, because it is
 * derived from the viewport size and would otherwise produce a new entry
 * on every single resize event. 0.05 turns is well below what the eye can
 * tell apart, and the cache is small and bounded.
 */
const geometryCache = new Map<number, Geometry>();
export const buildGeometryFor = (turns: number): Geometry => {
  const key = Math.max(0.1, Math.round(turns * 20) / 20);
  const cached = geometryCache.get(key);
  if (cached) return cached;
  if (geometryCache.size >= 12) geometryCache.clear();
  const built = buildGeometry(key);
  geometryCache.set(key, built);
  return built;
};

