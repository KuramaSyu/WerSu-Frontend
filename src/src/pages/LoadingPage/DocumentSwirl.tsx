import { Box, type SxProps, type Theme, useTheme } from "@mui/material";
import { IconCoffee } from "@tabler/icons-react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import React from "react";
import { useAppReducedMotion } from "../../hooks/useAppReducedMotion";

/**
 * DocumentSwirl
 * -------------
 * The decorative spiral behind the logo on the splash and login
 * screens. It is meant to feel hand-drawn and alive:
 *
 *   - the radius carries several low-frequency "bumps" (tapered to zero
 *     at the outer end) so the line wobbles like the Life is Strange
 *     swirl
 *   - the line is a filled ribbon whose thickness swells and pinches
 *   - it is oversized on purpose: the stage is sized from the anchor to
 *     the farthest screen corner, then scaled so the ribbon always runs
 *     off every edge (no visible border)
 *   - the number of spins scales with the screen (fewer on mobile, more
 *     on a large display)
 *   - documents drift *around* the ribbon and swell + spin under the
 *     cursor, each in a random palette colour
 *   - fast glowing pulses race outwards on the ribbon
 *   - it reacts to the pointer, keystrokes (backspace spins the other
 *     way), clicks/space (fast bursts) and the scroll wheel
 *
 * All animation is driven from a single rAF loop writing into
 * MotionValues, so nothing re-renders React while it moves.
 */

// ---------------------------------------------------------------------------
// Spiral geometry (all in the 0..100 coordinate space)
// ---------------------------------------------------------------------------

/** Innermost radius of the ribbon, in the 0..100 stage coordinate space. */
const R_INNER = 4;
/**
 * Outermost radius. It deliberately reaches past the visible area: the
 * stage is scaled so this tip always ends up off screen (see the layout
 * measuring effect), which is what hides the flat cut at the end of the
 * ribbon.
 */
const R_OUTER = 55;

/**
 * Deterministic pseudo-random in [0, 1) derived from a numeric seed.
 * Using a seeded value instead of `Math.random()` keeps an element's
 * "random" look stable across renders and geometry rebuilds (so notes
 * don't jump when the window is resized).
 */
const rand = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Always-positive modulo, so angles wrap cleanly even for negatives. */
const mod = (value: number, range: number): number =>
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
const computeTurns = (vw: number, vh: number): number => {
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
  // then the inner edge back, and fill between them. The sample count
  // scales with length so long ribbons don't look faceted.
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

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const buildPalette = (theme: Theme): string[] => {
  const p = theme.palette;
  return [
    p.primary.main,
    p.primary.light,
    p.primary.dark,
    p.secondary.main,
    p.secondary.light,
    p.secondary.dark,
  ].filter((c): c is string => Boolean(c));
};

// ---------------------------------------------------------------------------
// Documents (drift around the ribbon)
// ---------------------------------------------------------------------------

/** Per-document tuning. Generated once from seeded randomness below. */
interface DocSpec {
  /** Starting position as a fraction of the spiral (0..1). */
  t0: number;
  /** Multiplier on the shared flow speed (≈ uniform, so they stay orderly). */
  speed: number;
  /** Seed for picking this note's palette colour. */
  colorSeed: number;
  /** How far it drifts off the line, radially (stage units). */
  radialAmp: number;
  /** Frequency of the radial drift along the path. */
  radialFreq: number;
  /** Phase offset of the radial drift. */
  radialPhase: number;
  /** How far it drifts along the line (radians of angle). */
  angularAmp: number;
  /** Frequency of the angular drift along the path. */
  angularFreq: number;
  /** Phase offset of the angular drift. */
  angularPhase: number;
  /** Degrees of self-rotation per radian travelled (the constant tumble). */
  spinRate: number;
  /** Multiplies the base card size. */
  sizeMul: number;
  /** How much the card rocks around the tangent direction. */
  wobbleAmp: number;
}

/** Number of cards riding the ribbon at any time. */
const DOC_COUNT = 16;

const DOCS: DocSpec[] = Array.from({ length: DOC_COUNT }, (_, i) => {
  const R = (n: number) => rand(i * 7.3 + n);
  // Spread the notes evenly along the path, with just a little jitter so
  // it doesn't look grid-like.
  return {
    t0: mod(i / DOC_COUNT + R(1) * (0.35 / DOC_COUNT), 1),
    // Nearly uniform speeds: an orderly flow rather than chaos.
    speed: 0.5 + R(2) * 0.2,
    colorSeed: i * 3 + 1,
    radialAmp: 0.6 + R(3) * 1.2,
    radialFreq: 0.5 + R(4) * 0.8,
    radialPhase: R(5) * Math.PI * 2,
    angularAmp: (R(6) - 0.5) * 0.06,
    angularFreq: 0.4 + R(7) * 0.7,
    angularPhase: R(8) * Math.PI * 2,
    spinRate: 20 + R(9) * 15,
    sizeMul: 0.9 + R(10) * 0.2,
    wobbleAmp: 8 + R(11) * 10,
  };
});

// A note is the ribbon position shifted by a slow radial drift and a slow
// angular drift, so it hovers *around* the line instead of sitting exactly
// on it. All four helpers are pure and called from MotionValue transforms.

/** Radius of a note: the ribbon radius plus its radial drift. */
const noteRadius = (geo: Geometry, spec: DocSpec, theta: number): number =>
  geo.radius(theta) +
  spec.radialAmp * Math.sin(theta * spec.radialFreq + spec.radialPhase);

/** Angle of a note: its path angle plus the angular drift. */
const noteTheta = (spec: DocSpec, theta: number): number =>
  theta +
  spec.angularAmp * Math.sin(theta * spec.angularFreq + spec.angularPhase);

/** Final X (0..100) of a note, from its drifted polar coordinates. */
const noteX = (geo: Geometry, spec: DocSpec, theta: number): number =>
  50 + noteRadius(geo, spec, theta) * Math.cos(noteTheta(spec, theta));
/** Final Y (0..100) of a note, from its drifted polar coordinates. */
const noteY = (geo: Geometry, spec: DocSpec, theta: number): number =>
  50 + noteRadius(geo, spec, theta) * Math.sin(noteTheta(spec, theta));

/**
 * A single, hand-drawn style document card: an outlined page with a
 * folded corner and a few squiggle "text" lines. Drawn in a 16×21 box
 * and scaled to whatever size the parent gives it.
 */
const DocumentGlyph: React.FC = () => (
  <Box
    component="svg"
    viewBox="0 0 16 21"
    sx={{
      display: "block",
      width: "100%",
      height: "auto",
      overflow: "visible",
      filter: "drop-shadow(0 0 7px currentColor)",
    }}
  >
    <path
      d="M2.6 1.4 H10.3 L13.4 4.5 V19.6 H2.6 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.15}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path
      d="M10.3 1.4 V4.5 H13.4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.15}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path
      d="M5 9 q1.1 -0.9 2.2 0 t2.2 0"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.8}
      strokeLinecap="round"
      opacity={0.85}
    />
    <path
      d="M5 12 q1.1 -0.9 2.2 0 t2.2 0"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.8}
      strokeLinecap="round"
      opacity={0.85}
    />
    <path
      d="M5 15 q1.1 -0.9 2.2 0"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.8}
      strokeLinecap="round"
      opacity={0.85}
    />
  </Box>
);

interface DocumentSpriteProps {
  geo: Geometry;
  flow: MotionValue<number>;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  spec: DocSpec;
  index: number;
  color: string;
}

const DocumentSprite: React.FC<DocumentSpriteProps> = ({
  geo,
  flow,
  pointerX,
  pointerY,
  spec,
  index,
  color,
}) => {
  const span = geo.thetaMax - geo.thetaMin;
  // Fixed starting angle for this note, then it just rides the shared flow.
  const base = geo.thetaMin + spec.t0 * span;

  // Angle along the path, wrapped so the note loops forever.
  const theta = useTransform(flow, (f) => geo.wrapTheta(base + f * spec.speed));

  // Normalised 0..1 position along the path (drives size/opacity/limit).
  const progress = useTransform(theta, (th) => (th - geo.thetaMin) / span);

  // Position in percent of the stage. The wrapper has zero size and the
  // inner element is centred with -50%/-50%.
  const left = useTransform(theta, (th) => `${noteX(geo, spec, th)}%`);
  const top = useTransform(theta, (th) => `${noteY(geo, spec, th)}%`);

  // Fade in near the centre and out at the rim so the wrap is invisible.
  const opacity = useTransform(
    progress,
    (p) => Math.min(1, p / 0.09) * Math.min(1, (1 - p) / 0.11),
  );

  // Base size plus a strong magnification when the card is near the
  // cursor, so notes swell as they pass underneath it.
  const scale = useTransform(
    [theta, pointerX, pointerY],
    ([th, pxv, pyv]: number[]) => {
      const p = (th - geo.thetaMin) / span;
      // Grow steadily along the way so departing notes are big…
      const size = 0.45 + 3.0 * p;
      // …and swell by an extra 1.5× over the final 20% of the path.
      const endBoost = p > 0.8 ? 1 + 0.5 * ((p - 0.8) / 0.2) : 1;
      const x = noteX(geo, spec, th);
      const y = noteY(geo, spec, th);
      const dist = Math.hypot(x - pxv, y - pyv);
      const near = Math.max(0, 1 - dist / 12);
      return size * endBoost * (1 + near * 1.25);
    },
  );

  // Align to the ribbon tangent, add a lazy wobble, a constant tumble,
  // and an extra full spin whenever the cursor is on top of the card.
  const rotate = useTransform(
    [theta, pointerX, pointerY],
    ([th, pxv, pyv]: number[]) => {
      const x = noteX(geo, spec, th);
      const y = noteY(geo, spec, th);
      const dist = Math.hypot(x - pxv, y - pyv);
      const near = Math.max(0, 1 - dist / 9);
      const tumble = th * spec.spinRate;
      const hover = near * near * 320;
      const wobble = spec.wobbleAmp * Math.sin(th * 1.8 + index * 2.1);
      return geo.tangentDeg(th) + wobble + tumble + hover;
    },
  );

  return (
    <motion.div
      style={{ position: "absolute", left, top, width: 0, height: 0 }}
    >
      <motion.div
        style={{
          x: "-50%",
          y: "-50%",
          opacity,
          scale,
          rotate,
          color,
          width: `calc(clamp(24px, 5.4vmin, 76px) * ${spec.sizeMul.toFixed(2)})`,
        }}
      >
        <DocumentGlyph />
      </motion.div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Pulses (fast, exactly on the ribbon)
// ---------------------------------------------------------------------------

/** A travelling glow. Unlike notes, pulses sit exactly on the ribbon. */
interface PulseSpec {
  /** Starting position as a fraction of the spiral (0..1). */
  t0: number;
  /** Multiplier on the shared flow speed (faster than the notes). */
  speed: number;
  /** Seed for picking the palette colour. */
  colorSeed: number;
}

/** Five pulses, spread randomly around the path, each a bit faster than notes. */
const PULSES: PulseSpec[] = Array.from({ length: 5 }, (_, i) => ({
  t0: rand(i + 41),
  speed: 0.7 + rand(i + 71) * 0.4,
  colorSeed: i * 5 + 2,
}));

interface PulseProps {
  geo: Geometry;
  flow: MotionValue<number>;
  spec: PulseSpec;
  color: string;
}

const Pulse: React.FC<PulseProps> = ({ geo, flow, spec, color }) => {
  const span = geo.thetaMax - geo.thetaMin;
  const base = geo.thetaMin + spec.t0 * span;

  // Same looping-ride idea as the notes, but positioned exactly on the
  // ribbon (no radial/angular drift) and a bit faster.
  const theta = useTransform(flow, (f) => geo.wrapTheta(base + f * spec.speed));
  const progress = useTransform(theta, (th) => (th - geo.thetaMin) / span);
  const left = useTransform(theta, (th) => `${geo.posX(th)}%`);
  const top = useTransform(theta, (th) => `${geo.posY(th)}%`);
  // Brightest mid-journey, invisible at both ends.
  const opacity = useTransform(progress, (p) => Math.sin(p * Math.PI));
  // Grows as it races outward.
  const scale = useTransform(progress, (p) => 0.5 + 1.4 * p);

  return (
    <motion.div
      style={{ position: "absolute", left, top, width: 0, height: 0 }}
    >
      <motion.div
        style={{
          x: "-50%",
          y: "-50%",
          opacity,
          scale,
          color,
          width: "clamp(30px, 7vmin, 110px)",
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, #ffffff 0%, currentColor 20%, transparent 66%)",
          filter: "blur(0.5px)",
          mixBlendMode: "screen",
        }}
      />
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Bursts (fired by space / click)
// ---------------------------------------------------------------------------

/** Seconds a click/space pulse takes to fly from the centre off-screen. */
const BURST_DURATION = 0.9;
// Hard ceiling on how fast the swirl can spin, no matter how hard the
// user mashes keys or spins the wheel.
const MAX_SPIN_VELOCITY = 80; // degrees / second
// Furthest the accumulated rotation can wind away from centre. Reaching
// it simply stops further rotation, so spamming can't spin forever — and
// it never rotates back on its own.
const MAX_ROTATION = 360; // degrees
// The coffee is a leisurely traveller: a bit slower than the notes (which
// run at 0.5–0.7× the shared flow).
const COFFEE_SPEED = 0.35;
// Probability denominator for the coffee easter egg; the actual chance
// ramps up with each miss (see `spawnBurst`).
const COFFEE_ONE_IN = 42;

interface BurstProps {
  geo: Geometry;
  flow: MotionValue<number>;
  color: string;
  /** The rare 1/42 treat: a big coffee cup instead of a glow. */
  coffee?: boolean;
  onDone: () => void;
}

const Burst: React.FC<BurstProps> = ({
  geo,
  flow,
  color,
  coffee = false,
  onDone,
}) => {
  const done = React.useRef(false);

  // Two different ways to travel the spiral:
  //  - a fast pulse owns its own progress and finishes in BURST_DURATION
  //  - the coffee rides the shared `flow` so it drifts at a note-like pace
  const selfProgress = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    if (coffee) return;
    selfProgress.set(
      selfProgress.get() + Math.min(delta, 50) / 1000 / BURST_DURATION,
    );
  });

  const startFlow = React.useRef(flow.get());
  const coffeeProgress = useTransform(flow, (f) => {
    const span = geo.thetaMax - geo.thetaMin;
    const p = ((f - startFlow.current) * COFFEE_SPEED) / span;
    return Math.min(1, Math.max(0, p));
  });

  const progress = coffee ? coffeeProgress : selfProgress;

  useMotionValueEvent(progress, "change", (v) => {
    if (v >= 1 && !done.current) {
      done.current = true;
      onDone();
    }
  });

  const theta = useTransform(
    progress,
    (p) => geo.thetaMin + Math.min(1, p) * (geo.thetaMax - geo.thetaMin),
  );
  const left = useTransform(theta, (th) => `${geo.posX(th)}%`);
  const top = useTransform(theta, (th) => `${geo.posY(th)}%`);
  const opacity = useTransform(progress, (p) =>
    coffee
      ? Math.min(1, p / 0.05) * Math.min(1, (1 - p) / 0.08)
      : Math.sin(Math.min(1, p) * Math.PI),
  );
  // The coffee starts already fairly big and swells further; pulses are
  // small at the centre and balloon as they leave.
  const scale = useTransform(progress, (p) =>
    coffee ? 0.7 + 1.7 * p : 0.4 + 1.8 * p,
  );
  // 12 full turns over the journey (coffee only; pulses ignore this).
  const spin = useTransform(progress, (p) => -40 + Math.min(1, p) * 4320);

  if (coffee) {
    return (
      <motion.div
        style={{ position: "absolute", left, top, width: 0, height: 0 }}
      >
        <motion.div
          style={{
            x: "-50%",
            y: "-50%",
            opacity,
            scale,
            rotate: spin,
            color,
            width: "clamp(90px, 18vmin, 320px)",
            aspectRatio: "1 / 1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            filter: "drop-shadow(0 0 22px currentColor)",
          }}
        >
          <IconCoffee stroke={1} style={{ width: "100%", height: "100%" }} />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      style={{ position: "absolute", left, top, width: 0, height: 0 }}
    >
      <motion.div
        style={{
          x: "-50%",
          y: "-50%",
          opacity,
          scale,
          color,
          width: "clamp(40px, 9vmin, 150px)",
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, #ffffff 0%, currentColor 22%, transparent 64%)",
          filter: "blur(0.5px)",
          mixBlendMode: "screen",
        }}
      />
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface DocumentSwirlProps {
  /** React to pointer / keyboard / click / scroll input. Defaults to true. */
  interactive?: boolean;
  /**
   * Element whose centre the swirl is built around. When omitted the
   * component's own box centre is used. Useful when the component is a
   * full-screen layer but the logo lives elsewhere.
   */
  anchorRef?: React.RefObject<HTMLElement | null>;
  sx?: SxProps<Theme>;
}

export const DocumentSwirl: React.FC<DocumentSwirlProps> = ({
  interactive = true,
  anchorRef,
  sx,
}) => {
  const theme = useTheme();
  const reduceMotion = useAppReducedMotion();

  // Palette pulled from the theme; the first entry is the base colour and
  // two others become the ribbon gradient. `useId` keeps the <linearGradient>
  // id unique when several swirls are mounted at once.
  const palette = React.useMemo(() => buildPalette(theme), [theme]);
  const baseColor = palette[0] ?? theme.palette.primary.main;
  const ribbonFrom = palette[1] ?? baseColor;
  const ribbonTo = palette[4] ?? baseColor;
  const uid = React.useId().replace(/:/g, "");
  const gradientId = `swirl-grad-${uid}`;

  const colorFor = React.useCallback(
    (seed: number) =>
      palette[Math.floor(rand(seed) * palette.length)] ?? baseColor,
    [palette, baseColor],
  );

  const rootRef = React.useRef<HTMLDivElement>(null);
  // Latest measured anchor centre + stage size, read by pointer math
  // without forcing a re-render on every mouse move.
  const geometry = React.useRef({ cx: 0, cy: 0, stage: 2000 });

  // Layout is measured: stage size, anchor offset and total spins. It is
  // state because changing the spin count rebuilds the geometry.
  const [layout, setLayout] = React.useState(() => ({
    stage:
      typeof window === "undefined"
        ? 2000
        : Math.max(window.innerWidth, window.innerHeight) * 2,
    dx: 0,
    dy: 0,
    turns: computeTurns(
      typeof window === "undefined" ? 1200 : window.innerWidth,
      typeof window === "undefined" ? 800 : window.innerHeight,
    ),
  }));

  // Measure on mount, on resize, and whenever the anchor changes size.
  // We need three things: how big the (square) stage must be so the outer
  // tip clears the farthest screen corner, how far the stage is offset
  // from this component's own centre, and how many spins to draw.
  React.useEffect(() => {
    const measure = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const rootCx = rect.left + rect.width / 2;
      const rootCy = rect.top + rect.height / 2;

      // Centre the spiral on the anchor element when provided (e.g. the
      // logo), otherwise on this component's own box.
      const anchorEl = anchorRef?.current;
      let anchorCx = rootCx;
      let anchorCy = rootCy;
      if (anchorEl) {
        const ar = anchorEl.getBoundingClientRect();
        anchorCx = ar.left + ar.width / 2;
        anchorCy = ar.top + ar.height / 2;
      }

      // Distance from the spiral centre to the farthest viewport corner.
      // The stage must be big enough that the ribbon's outer tip (at
      // R_OUTER% of the stage) sits beyond this distance.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxDist = Math.max(
        Math.hypot(anchorCx, anchorCy),
        Math.hypot(vw - anchorCx, anchorCy),
        Math.hypot(anchorCx, vh - anchorCy),
        Math.hypot(vw - anchorCx, vh - anchorCy),
      );
      // 8% margin so even the wobble at the tip stays off screen.
      const stage = (maxDist / (R_OUTER / 100)) * 1.08;
      geometry.current = { cx: anchorCx, cy: anchorCy, stage };

      setLayout({
        stage,
        dx: anchorCx - rootCx,
        dy: anchorCy - rootCy,
        turns: computeTurns(vw, vh),
      });
    };

    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    if (rootRef.current) ro.observe(rootRef.current);
    if (anchorRef?.current) ro.observe(anchorRef.current);
    const t = window.setTimeout(measure, 400);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [anchorRef]);

  // Geometry only depends on the spin count, so it rebuilds on screen
  // size bucket changes rather than every resize event.
  const geo = React.useMemo(() => buildGeometry(layout.turns), [layout.turns]);

  // Shared motion values written by the single rAF loop below and read by
  // every child transform. Driving them here (instead of React state) is
  // what lets the whole swirl animate without re-rendering.
  //   flow      – how far everything has travelled along the ribbon (radians)
  //   rotation  – swirl twist in degrees (ambient rock + user spin)
  //   shiftX/Y  – gentle ambient drift in px
  //   breathe   – whole-line opacity 0..1
  //   sway      – whole-assembly scale
  const flow = useMotionValue(reduceMotion ? 4.2 : 0);
  const rotation = useMotionValue(0);
  const shiftX = useMotionValue(0);
  const shiftY = useMotionValue(0);
  const breathe = useMotionValue(reduceMotion ? 1 : 0.55);
  const sway = useMotionValue(1);

  // Pointer position, in spiral-stage units (drives the notes only).
  const pointerStageX = useMotionValue(-999);
  const pointerStageY = useMotionValue(-999);
  const pointerSpeedTarget = useMotionValue(0);
  const pointerSpeed = useSpring(pointerSpeedTarget, {
    stiffness: 220,
    damping: 26,
    mass: 0.5,
  });

  const clock = React.useRef(0);
  const flowRef = React.useRef(flow.get());
  // Accumulated rotation target. Keystrokes/scroll move it and it stays —
  // it never springs back — but it is clamped so spamming can't wind it
  // up forever.
  const spinTarget = React.useRef(0);
  const spinValue = React.useRef(0);
  const spinVelocity = React.useRef(0);
  const lastPointer = React.useRef<{ x: number; y: number; t: number } | null>(
    null,
  );

  // Fast pulses and the (independent) coffee-cup easter egg. Coffees live
  // in their own list so a flurry of pulses can never push them out.
  const [bursts, setBursts] = React.useState<{ id: number; color: string }[]>(
    [],
  );
  const [coffees, setCoffees] = React.useState<{ id: number; color: string }[]>(
    [],
  );
  const burstId = React.useRef(0);
  const coffeeMisses = React.useRef(0);
  const lastCoffeeAt = React.useRef(0);
  const warningColor = theme.palette.warning.main;
  const removeBurst = React.useCallback((id: number) => {
    setBursts((prev) => prev.filter((b) => b.id !== id));
  }, []);
  const removeCoffee = React.useCallback((id: number) => {
    setCoffees((prev) => prev.filter((c) => c.id !== id));
  }, []);
  const spawnCoffee = React.useCallback(
    (withDebounce = false) => {
      if (!interactive || reduceMotion) return;
      if (withDebounce) {
        const now = performance.now();
        if (now - lastCoffeeAt.current < 1000) return;
        lastCoffeeAt.current = now;
      }
      const id = burstId.current++;
      setCoffees((prev) => {
        const next = prev.length >= 3 ? prev.slice(1) : prev;
        return [...next, { id, color: warningColor }];
      });
    },
    [interactive, reduceMotion, warningColor],
  );
  const spawnBurst = React.useCallback(() => {
    if (!interactive || reduceMotion) return;
    // Pity system: the chance grows with every miss so a bad run can't
    // drag on forever, while the *base* rate stays around 1 in 42.
    const chance = Math.min(1, (coffeeMisses.current + 1) / COFFEE_ONE_IN);
    if (Math.random() < chance) {
      coffeeMisses.current = 0;
      spawnCoffee();
      return;
    }
    coffeeMisses.current += 1;
    const id = burstId.current++;
    setBursts((prev) => {
      const next = prev.length >= 8 ? prev.slice(1) : prev;
      return [...next, { id, color: colorFor(rand(id * 3.7) * 997) }];
    });
  }, [interactive, reduceMotion, colorFor, spawnCoffee]);

  const kick = React.useCallback(
    (amount: number) => {
      if (!interactive || reduceMotion) return;
      spinTarget.current = Math.max(
        -MAX_ROTATION,
        Math.min(MAX_ROTATION, spinTarget.current + amount),
      );
    },
    [interactive, reduceMotion],
  );

  // Pointer tracking. This only ever feeds the notes: their position for
  // the "under the cursor" spin/scale, and their speed via `pointerSpeed`.
  // The swirl itself is deliberately not moved by the cursor.
  React.useEffect(() => {
    if (!interactive || reduceMotion) return;
    const onMove = (e: PointerEvent) => {
      const g = geometry.current;
      if (g.stage > 0) {
        pointerStageX.set(50 + ((e.clientX - g.cx) / g.stage) * 100);
        pointerStageY.set(50 + ((e.clientY - g.cy) / g.stage) * 100);
      }

      const now = performance.now();
      const prev = lastPointer.current;
      if (prev) {
        const dt = Math.max(8, now - prev.t);
        const dist = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
        pointerSpeedTarget.set(Math.min(4, dist / dt));
      }
      lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [
    interactive,
    reduceMotion,
    pointerStageX,
    pointerStageY,
    pointerSpeedTarget,
  ]);

  // Keystrokes. Every key nudges the swirl's rotation target (a short,
  // snappy turn in the matching direction); space also fires a pulse and
  // `@` force-spawns a coffee (debounced to one per second).
  React.useEffect(() => {
    if (!interactive || reduceMotion) return;
    const IGNORE = new Set([
      "Shift",
      "Control",
      "Alt",
      "Meta",
      "CapsLock",
      "Escape",
      "Tab",
      "Dead",
    ]);
    const onKeyDown = (e: KeyboardEvent) => {
      if (IGNORE.has(e.key)) return;
      if (e.key === "Backspace") kick(-84);
      else if (e.key === "ArrowLeft") kick(55);
      else if (e.key === "ArrowRight") kick(-55);
      else if (e.key === "ArrowUp") kick(24);
      else if (e.key === "ArrowDown") kick(-24);
      else if (e.key === " ") {
        kick(48);
        spawnBurst();
      } else if (e.key === "@") spawnCoffee(true);
      else if (e.key.length === 1) kick(28);
      else kick(25);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [interactive, reduceMotion, kick, spawnBurst, spawnCoffee]);

  // Click/tap -> a pulse (or, rarely, a coffee); scroll wheel -> spin.
  // Both are attached to `window` so the whole screen is a hit target.
  React.useEffect(() => {
    if (!interactive || reduceMotion) return;
    const onPointerDown = () => spawnBurst();
    const onWheel = (e: WheelEvent) => {
      const amount = Math.max(-80, Math.min(80, e.deltaY * 0.18));
      kick(amount);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [interactive, reduceMotion, spawnBurst, kick]);

  // The one place time advances. Delta is clamped so a stalled tab
  // (or a long frame) can't make everything jump on resume.
  useAnimationFrame((_, delta) => {
    if (reduceMotion) return;
    const dt = Math.min(delta, 50) / 1000;
    clock.current += dt;

    // Near-critically damped follow of the accumulated target: quick,
    // decisive, and it stays put afterwards.
    const spinDiff = spinTarget.current - spinValue.current;
    spinVelocity.current += spinDiff * 6.0 * dt;
    spinVelocity.current *= Math.exp(-5.0 * dt);
    // Spam protection: never exceed MAX_SPIN_VELOCITY.
    spinVelocity.current = Math.max(
      -MAX_SPIN_VELOCITY,
      Math.min(MAX_SPIN_VELOCITY, spinVelocity.current),
    );
    spinValue.current += spinVelocity.current * dt;

    pointerSpeedTarget.set(pointerSpeedTarget.get() * Math.exp(-8 * dt));

    const speed = pointerSpeed.get();

    // The swirl itself never follows the cursor: only typing / scrolling
    // twists it. The pointer only stirs the notes.
    const baseOsc = Math.sin(clock.current * 0.32) * 9;
    rotation.set(baseOsc + spinValue.current);

    // Repeating ease-in-out for the notes, but every boost is capped and
    // the product is clamped, so the top speed stays civil no matter how
    // hard you type or move the mouse.
    const breath =
      0.7 + 0.4 * (0.5 + 0.5 * Math.sin(clock.current * 0.45 - Math.PI / 2));
    const spinBoost = 1 + Math.min(0.5, Math.abs(spinVelocity.current) * 0.008);
    const windBoost = 1 + Math.min(0.6, speed * 0.4);
    const velocity = Math.min(1.3, breath * spinBoost * windBoost);
    flowRef.current += dt * 0.85 * velocity;
    flow.set(flowRef.current);

    shiftX.set(Math.sin(clock.current * 0.63) * 6);
    shiftY.set(Math.cos(clock.current * 0.51) * 6);

    const b =
      0.6 + 0.4 * (0.5 + 0.5 * Math.sin(clock.current * 0.5 - Math.PI / 2));
    breathe.set(b);
    sway.set(0.97 + 0.035 * b);
  });

  // Render nesting, outermost first:
  //   root (this box, full size, click-through / unselectable)
  //     stage        – huge square centred on the anchor
  //       sway       – whole-assembly scale
  //         shift    – ambient drift
  //           rotation – ambient rock + user spin
  //             breathe  – line + pulses only
  //             notes / bursts / coffees (kept bright)
  return (
    <Box
      ref={rootRef}
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "visible",
        pointerEvents: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        color: baseColor,
        ...sx,
      }}
    >
      <Box
        sx={{
          // Square stage, offset so its centre lands on the measured anchor.
          position: "absolute",
          top: `calc(50% + ${layout.dy}px)`,
          left: `calc(50% + ${layout.dx}px)`,
          width: `${layout.stage}px`,
          height: `${layout.stage}px`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <motion.div style={{ position: "absolute", inset: 0, scale: sway }}>
          <motion.div
            style={{ position: "absolute", inset: 0, x: shiftX, y: shiftY }}
          >
            <motion.div
              style={{ position: "absolute", inset: 0, rotate: rotation }}
            >
              {/* The ribbon and its pulses fade in/out together so the
                  line appears to breathe, while the notes stay steady. */}
              <motion.div
                style={{ position: "absolute", inset: 0, opacity: breathe }}
              >
                <Box
                  component="svg"
                  viewBox="0 0 100 100"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    overflow: "visible",
                  }}
                >
                  <defs>
                    <linearGradient
                      id={gradientId}
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor={ribbonFrom} />
                      <stop offset="55%" stopColor={baseColor} />
                      <stop offset="100%" stopColor={ribbonTo} />
                    </linearGradient>
                  </defs>
                  <path
                    d={geo.ribbonPath}
                    fill={`url(#${gradientId})`}
                    opacity={0.62}
                    style={{ filter: "drop-shadow(0 0 3px currentColor)" }}
                  />
                </Box>

                {/* Fast glows racing outward on the line. */}
                {PULSES.map((spec, i) => (
                  <Pulse
                    key={i}
                    geo={geo}
                    flow={flow}
                    spec={spec}
                    color={colorFor(spec.colorSeed)}
                  />
                ))}
              </motion.div>

              {/* …while documents and bursts stay bright. */}
              {DOCS.map((spec, i) => (
                <DocumentSprite
                  key={i}
                  geo={geo}
                  flow={flow}
                  pointerX={pointerStageX}
                  pointerY={pointerStageY}
                  spec={spec}
                  index={i}
                  color={colorFor(spec.colorSeed)}
                />
              ))}

              {bursts.map((b) => (
                <Burst
                  key={b.id}
                  geo={geo}
                  flow={flow}
                  color={b.color}
                  onDone={() => removeBurst(b.id)}
                />
              ))}

              {/* The rare coffee cups drift along like slow notes. */}
              {coffees.map((c) => (
                <Burst
                  key={c.id}
                  geo={geo}
                  flow={flow}
                  color={c.color}
                  coffee
                  onDone={() => removeCoffee(c.id)}
                />
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      </Box>
    </Box>
  );
};
