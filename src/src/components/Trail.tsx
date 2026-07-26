import { Children, isValidElement } from "react";
import { animated, config, useTrail } from "@react-spring/web";
import { useThemeStore } from "../zustand/useThemeStore";

/**
 * Wraps each direct child in an `animated.div` and staggers their
 * fade + slide-up using `useTrail` from `@react-spring/web`.
 *
 * The trail runs once on mount: each spring animates from
 * `{ opacity: 0, y: slideFrom }` to `{ opacity: 1, y: 0 }` with
 * `useTrail` orchestrating the per-index stagger (each spring
 * follows the previous one's progress via react-spring's chain
 * mechanism).
 *
 * Physics:
 * - Uses `config.gentle` by default: `{ tension: 120, friction: 14 }`.
 *   Smooth, underdamped, settles in roughly 500ms. Override via
 *   the `physics` prop.
 * - With physics, the actual settle time varies - it's no longer
 *   a fixed duration. The `onRest` callback lets consumers sequence
 *   additional Trails reliably (since the previous fixed-duration
 *   handoff math no longer matches real settle time).
 *
 * Re-trigger by changing the `key` prop on the parent - new
 * mount starts fresh springs and plays the trail again.
 *
 * Wrap-only semantics:
 * - The component adds an `animated.div` per child. The wrapper
 *   carries the spring styles (opacity + transform). The original
 *   child is untouched.
 * - Each child needs to be a stable React element (a `key`) so the
 *   wrapper identity is stable across renders.
 */
export interface TrailProps {
  /** Direct children to animate. Order matters - earlier = earlier in the trail. */
  children: React.ReactNode;
  /**
   * Per-step delay between items in milliseconds. Defaults to
   * `theme.transitions.duration.shortest` (~150ms in the MUI
   * default). Pass an explicit number to override.
   */
  step?: number;
  /**
   * Extra delay applied to every spring before the trail starts.
   * Use this to sequence two Trails - first dir Trail finishes,
   * then notes Trail starts after `dirsCount * step + extraDelay`
   * ms. For reliable handoff under physics, also use `onRest`.
   */
  startDelay?: number;
  /**
   * Initial translateY in pixels. Each item slides up from this
   * offset to `translateY(0)` as it fades in.
   */
  slideFrom?: number;
  /**
   * Spring physics config. Defaults to `config.gentle` -
   * `{ tension: 120, friction: 14 }`. Smooth underdamped settle.
   * Pass any named preset (`config.wobbly`, `config.stiff`, ...)
   * or a custom `{ tension, friction }` object.
   */
  physics?: typeof config.gentle;
  /**
   * Fired once all springs have settled. Useful for sequencing
   * another Trail after this one - the recommended pattern for
   * physics-based timing (since fixed-duration math no longer
     matches real settle time).
   */
  onRest?: () => void;
}

export const Trail: React.FC<TrailProps> = ({
  children,
  step,
  startDelay = 0,
  slideFrom = 0,
  physics = config.gentle,
  onRest,
}) => {
  const { theme } = useThemeStore();
  const stepMs = step ?? theme.transitions.duration.shortest;

  // `Children.toArray` collapses fragments and skips null/false
  // children, giving us a flat list of valid React elements to
  // count and map over. Invalid entries (e.g. raw strings) are
  // passed through unchanged so the trail length stays accurate.
  const items = Children.toArray(children);
  const length = items.length;

  const springs = useTrail(length, {
    from: { opacity: 0, y: slideFrom },
    to: { opacity: 1, y: 0 },
    delay: stepMs + startDelay,
    config: physics,
    onRest,
  });

  return (
    <>
      {items.map((child, index) => (
        <animated.div
          key={isValidElement(child) && child.key != null ? child.key : index}
          style={{
            opacity: springs[index].opacity,
            transform: springs[index].y.to((y) => `translateY(${y}px)`),
          }}
        >
          {child}
        </animated.div>
      ))}
    </>
  );
};
