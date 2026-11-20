/**
 * DocumentSwirl
 * -------------
 * The decorative spiral behind the logo on the splash and login screens.
 * It is meant to feel hand-drawn and alive:
 *
 *   - the radius carries several low-frequency "bumps" (tapered to zero
 *     at the outer end) so the line wobbles like the Life is Strange
 *     swirl (all of that math lives in `spiralGeometry`)
 *   - the line is a filled ribbon whose thickness swells and pinches
 *   - it is oversized on purpose: the stage is sized from the anchor to
 *     the farthest screen corner, then scaled so the ribbon always runs
 *     off every edge (no visible border)
 *   - the number of spins scales with the screen (fewer on mobile, more
 *     on a large display)
 *
 * What it does is deliberately minimal: it turns slowly in one
 * direction, the speed swells and dips, and once in a while it eases a
 * little the other way. That single transform is the whole animation,
 * so it stays cheap even on phones — the geometry is built once and
 * cached, and nothing re-renders React while it moves.
 *
 * Everything expensive (drifting document icons, glowing pulses, click
 * bursts, the coffee easter egg) has been split into `SwirlExtras`,
 * which is loaded lazily and only when those features are switched on.
 *
 * Keystrokes, clicks and the scroll wheel can stir the swirl, but only
 * when `ENABLE_INPUT_MOVEMENT` below is turned on.
 */

import { Box, type SxProps, type Theme, useTheme } from "@mui/material";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useSpring,
} from "framer-motion";
import React from "react";
import { useAppReducedMotion } from "../../hooks/useAppReducedMotion";
import {
  R_OUTER,
  buildGeometryFor,
  computeTurns,
  rand,
} from "./spiralGeometry";

/**
 * The optional riders (documents, pulses, bursts). Loaded on demand in a
 * separate chunk, so the lean swirl never ships or parses this code.
 */
const SwirlExtras = React.lazy(() => import("./SwirlExtras"));

// ---------------------------------------------------------------------------
// Motion tuning
// ---------------------------------------------------------------------------

/**
 * Ambient turn speed, in degrees per second. This is the swirl's own slow
 * rotation; the wave below keeps it at or below this.
 */
const AMBIENT_SPIN = 12;
// Hard ceiling on how fast the swirl can spin, no matter how hard the user
// mashes keys or spins the wheel.
const MAX_SPIN_VELOCITY = 80; // degrees / second
// Furthest the accumulated rotation can wind away from centre. Reaching it
// simply stops further rotation, so spamming can't spin forever — and it
// never rotates back on its own.
const MAX_ROTATION = 360; // degrees
/**
 * Master switch for the interactive layer: keypresses, pointer movement,
 * clicks and the scroll wheel. When false the swirl only does its slow
 * ambient rotation and no listeners are attached.
 */
const ENABLE_INPUT_MOVEMENT = false;
// Probability denominator for the coffee easter egg; the actual chance ramps
// up with each miss (see `spawnBurst`).
const COFFEE_ONE_IN = 42;

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

export interface DocumentSwirlProps {
  /** React to pointer / keyboard / click / scroll input. Defaults to true. */
  interactive?: boolean;
  /**
   * Draw the drifting document icons. Defaults to true, which pulls in the
   * lazily-loaded `SwirlExtras` chunk.
   */
  showDocuments?: boolean;
  /**
   * Draw the glowing pulses that race along the ribbon. Defaults to true,
   * which pulls in the lazily-loaded `SwirlExtras` chunk.
   */
  showPulses?: boolean;
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
  showDocuments = true,
  showPulses = true,
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
  // size bucket changes rather than every resize event. The cache keeps
  // remounts free.
  const geo = React.useMemo(() => buildGeometryFor(layout.turns), [
    layout.turns,
  ]);

  // Shared motion values written by the single rAF loop below and read by
  // every child transform. Driving them here (instead of React state) is
  // what lets the whole swirl animate without re-rendering.
  //   flow     – how far the notes/pulses have travelled (radians)
  //   rotation – the swirl's slow ambient turn, in degrees
  const flow = useMotionValue(reduceMotion ? 4.2 : 0);
  const rotation = useMotionValue(0);

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
  // Accumulated ambient rotation, in degrees.
  const rotationAngle = React.useRef(0);
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
  // Anything of the lazy extras on screen (or in flight)? Nothing in the
  // rAF loop needs to advance the ribbon when there is not.
  const ridingRibbon =
    showDocuments || showPulses || bursts.length > 0 || coffees.length > 0;
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
      if (!ENABLE_INPUT_MOVEMENT || !interactive || reduceMotion) return;
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
    if (!ENABLE_INPUT_MOVEMENT || !interactive || reduceMotion) return;
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
    if (!ENABLE_INPUT_MOVEMENT || !interactive || reduceMotion) return;
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
    if (!ENABLE_INPUT_MOVEMENT || !interactive || reduceMotion) return;
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

    // Ambient turn: one direction, with the speed slowly swelling and
    // dipping. The wave occasionally dips below zero, so now and then the
    // swirl eases a little the other way before carrying on. This is the
    // whole motion of the line — one transform, no per-item work.
    const wave =
      Math.sin(clock.current * 0.21) * 0.7 +
      Math.sin(clock.current * 0.09 + 1.7) * 0.3;
    rotationAngle.current += AMBIENT_SPIN * (0.3 + 0.7 * wave) * dt;

    // Optional user spin, added on top of the ambient turn.
    if (ENABLE_INPUT_MOVEMENT) {
      const spinDiff = spinTarget.current - spinValue.current;
      spinVelocity.current += spinDiff * 6.0 * dt;
      spinVelocity.current *= Math.exp(-5.0 * dt);
      spinVelocity.current = Math.max(
        -MAX_SPIN_VELOCITY,
        Math.min(MAX_SPIN_VELOCITY, spinVelocity.current),
      );
      spinValue.current += spinVelocity.current * dt;
      pointerSpeedTarget.set(pointerSpeedTarget.get() * Math.exp(-8 * dt));
    }

    rotation.set(rotationAngle.current + spinValue.current);

    // Nothing rides the ribbon unless the extras are on screen, so the flow
    // can simply stay put on the lean variant.
    if (ridingRibbon) {
      const speed = ENABLE_INPUT_MOVEMENT ? pointerSpeed.get() : 0;
      const spinBoost =
        1 + Math.min(0.5, Math.abs(spinVelocity.current) * 0.008);
      const windBoost = 1 + Math.min(0.6, speed * 0.4);
      const velocity = Math.min(1.3, spinBoost * windBoost);
      flowRef.current += dt * 0.85 * velocity;
      flow.set(flowRef.current);
    }
  });

  // Render nesting, outermost first:
  //   root (this box, full size, click-through / unselectable)
  //     stage     – huge square centred on the anchor
  //       rotation – the slow ambient turn (plus optional user spin)
  //         ribbon + lazily-loaded extras (pulses / notes / bursts)
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
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            rotate: rotation,
            willChange: "transform",
          }}
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

          {/* The optional riders live in a lazily-loaded chunk. Suspense
              only wraps them so the ribbon can paint immediately; the
              module is fetched the first time any of them is switched on. */}
          {ridingRibbon && (
            <React.Suspense fallback={null}>
              <SwirlExtras
                geo={geo}
                flow={flow}
                pointerX={pointerStageX}
                pointerY={pointerStageY}
                colorFor={colorFor}
                showDocuments={showDocuments}
                showPulses={showPulses}
                bursts={bursts}
                coffees={coffees}
                onBurstDone={removeBurst}
                onCoffeeDone={removeCoffee}
              />
            </React.Suspense>
          )}
        </motion.div>
      </Box>
    </Box>
  );
};
