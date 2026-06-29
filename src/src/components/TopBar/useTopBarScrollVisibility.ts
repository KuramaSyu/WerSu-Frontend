import { useEffect, useRef } from "react";

/**
 * The minimum downward distance that has to accumulate before the
 * top bar is allowed to *hide*. Anything tighter than this is
 * treated as accidental / inertial jitter on a trackpad or
 * touchpad, and not worth an animation.
 */
export const TOPBAR_HIDE_TRIGGER_DELTA = 4;

/**
 * Once the user has scrolled further than this from the top of the
 * page, scrolling *down* triggers a hide. Below this we assume the
 * user is near the top of the page and wants the navigation
 * visible regardless of direction.
 */
export const TOPBAR_TOP_THRESHOLD_PX = 24;

/**
 * Pure decision function used by `useTopBarScrollVisibility`.
 *
 * Returns one of:
 *   - `true`  — show the bar.
 *   - `false` — hide the bar.
 *   - `null`  — no change (the scroll delta was below the trigger,
 *               so the previous state should be preserved).
 *
 * Kept side-effect-free so it can be unit-tested without mounting
 * React or jsdom.
 *
 * @param y         The current scroll Y.
 * @param lastY     The previous scroll Y the watchdog recorded.
 * @param topPx     The "we're still at the top" threshold (see
 *                  `TOPBAR_TOP_THRESHOLD_PX`).
 * @param triggerPx The minimum downward delta (see
 *                  `TOPBAR_HIDE_TRIGGER_DELTA`).
 */
export function computeNextShowBar(
  y: number,
  lastY: number,
  topPx: number = TOPBAR_TOP_THRESHOLD_PX,
  triggerPx: number = TOPBAR_HIDE_TRIGGER_DELTA,
): boolean | null {
  const delta = y - lastY;
  if (Math.abs(delta) < triggerPx) {
    return null;
  }
  if (delta > 0 && y > topPx) {
    // Scrolling down and we're past the top → hide.
    return false;
  }
  if (delta < 0) {
    // Scrolling up → show.
    return true;
  }
  // Scrolling down but we're still in the top band → leave alone.
  return null;
}

/**
 * Watchdog hook that drives the top bar's show/hide state based on
 * the user's scroll direction.
 *
 * Owns nothing UI-side; it just attaches a passive `scroll`
 * listener to the configured target and forwards the outcome to
 * `setShowBar`. Splitting the rule out into a pure function
 * (`computeNextShowBar`) keeps the unit tests trivial.
 *
 * @param scrollContainer The DOM node whose scroll we observe.
 *                         `null`/`undefined` falls back to `window`.
 * @param setShowBar      The layout setter that toggles the visible
 *                         top bar.
 */
export function useTopBarScrollVisibility(
  scrollContainer: HTMLElement | null | undefined,
  setShowBar: (next: boolean) => void,
): void {
  // Track the previous `y` between events. A ref keeps the value
  // stable across renders without re-attaching the listener.
  const lastYRef = useRef(0);

  useEffect(() => {
    const target = scrollContainer ?? window;
    const getY = () =>
      scrollContainer ? scrollContainer.scrollTop : window.scrollY;
    lastYRef.current = getY();

    const onScroll = () => {
      const y = getY();
      const decision = computeNextShowBar(y, lastYRef.current);
      if (decision !== null) {
        setShowBar(decision);
      }
      // Update the ref *after* the decision so each event is judged
      // against the position the user *started* scrolling from,
      // matching the previous behaviour.
      lastYRef.current = y;
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [scrollContainer, setShowBar]);
}
