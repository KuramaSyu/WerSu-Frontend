/**
 * SwirlExtras
 * -----------
 * The optional, expensive half of `DocumentSwirl`: drifting document
 * icons, the glowing pulses that race along the ribbon, and the click /
 * space bursts (plus the rare coffee easter egg).
 *
 * It lives in its own module and is pulled in with `React.lazy`, so the
 * splash/login screens only pay for it when a consumer actually turns
 * `showDocuments` / `showPulses` on. The lean swirl never loads it.
 *
 * All animation is driven from the shared `flow` / pointer MotionValues
 * owned by `DocumentSwirl`, so nothing here advances time on its own
 * (except the short-lived burst progress).
 */

import { Box } from "@mui/material";
import { IconCoffee } from "@tabler/icons-react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from "framer-motion";
import React from "react";
import { mod, rand, type Geometry } from "./spiralGeometry";

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
// The coffee is a leisurely traveller: a bit slower than the notes (which
// run at 0.5–0.7× the shared flow).
const COFFEE_SPEED = 0.35;

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

export interface SwirlExtrasProps {
  geo: Geometry;
  /** Shared travel along the ribbon, advanced by `DocumentSwirl`. */
  flow: MotionValue<number>;
  /** Pointer position in stage units, only for the hover enlarge/spin. */
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  /** Picks a palette colour for a given seed. */
  colorFor: (seed: number) => string;
  showDocuments: boolean;
  showPulses: boolean;
  bursts: { id: number; color: string }[];
  coffees: { id: number; color: string }[];
  onBurstDone: (id: number) => void;
  onCoffeeDone: (id: number) => void;
}

/**
 * Everything that rides the ribbon. Rendered inside the swirl's rotating
 * layer, so it inherits the ambient turn for free.
 */
const SwirlExtras: React.FC<SwirlExtrasProps> = ({
  geo,
  flow,
  pointerX,
  pointerY,
  colorFor,
  showDocuments,
  showPulses,
  bursts,
  coffees,
  onBurstDone,
  onCoffeeDone,
}) => (
  <>
    {showPulses &&
      PULSES.map((spec, i) => (
        <Pulse
          key={i}
          geo={geo}
          flow={flow}
          spec={spec}
          color={colorFor(spec.colorSeed)}
        />
      ))}

    {showDocuments &&
      DOCS.map((spec, i) => (
        <DocumentSprite
          key={i}
          geo={geo}
          flow={flow}
          pointerX={pointerX}
          pointerY={pointerY}
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
        onDone={() => onBurstDone(b.id)}
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
        onDone={() => onCoffeeDone(c.id)}
      />
    ))}
  </>
);

export default SwirlExtras;
