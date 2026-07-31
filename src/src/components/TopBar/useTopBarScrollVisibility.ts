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
 * Tolerance (in px) for treating the current scroll position as
 * "at the bottom" of its container. Browsers and OSes emit a brief
 * negative delta once the user has flung to the end: rubber-band
 * overscroll on macOS trackpads typically lands within ~30-50 px of
 * the actual bottom, and a similar magnitude shows up when the
 * trackpad's inertial motion overshoots a clamped `scrollTop`. We
 * treat anything within this many px of `scrollHeight - clientHeight`
 * as the edge and ignore upward signals there.
 *
 * Picked at 50 px on purpose: a deliberate upward scroll that
 * starts within 50 px of the bottom only moves the visible content
 * a few px up — not enough to make the user want the navigation
 * back. Any larger upward delta opens the guard back up.
 */
export const TOPBAR_BOTTOM_EDGE_SLACK_PX = 50;

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
 * @param bottomY   When provided, an upward delta that lands at or
 *                  within `TOPBAR_BOTTOM_EDGE_SLACK_PX` of `bottomY`
 *                  is treated as rubber-band overscroll and
 *                  suppressed (`null` instead of `true`). This stops
 *                  the top bar from popping back in when the user
 *                  flings down past the end of the page and the
 *                  browser bounces.
 */
export function computeNextShowBar(
  y: number,
  lastY: number,
  topPx: number = TOPBAR_TOP_THRESHOLD_PX,
  triggerPx: number = TOPBAR_HIDE_TRIGGER_DELTA,
  bottomY: number | null = null,
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
    // Suppress rubber-band overscroll at the bottom edge: a real
    // upward scroll that should reveal the bar has to start from
    // somewhere the user can still see content above — which a
    // bottom-edge bounce doesn't.
    if (bottomY !== null && y >= bottomY - TOPBAR_BOTTOM_EDGE_SLACK_PX) {
      return null;
    }
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
    // The bottom edge of the container is `scrollHeight - clientHeight`,
    // but it can be 0 if the container hasn't laid out yet or isn't
    // scrollable. Only `window` (fallback target) has no per-target
    // bottom — leave `null` there so the rule is unchanged.
    const getBottomY = (): number | null => {
      if (!scrollContainer) return null;
      const max = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      // Negative means the container can't scroll (content fits).
      return max > 0 ? max : null;
    };
    lastYRef.current = getY();

    const onScroll = () => {
      const y = getY();
      const decision = computeNextShowBar(
        y,
        lastYRef.current,
        TOPBAR_TOP_THRESHOLD_PX,
        TOPBAR_HIDE_TRIGGER_DELTA,
        getBottomY(),
      );
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
