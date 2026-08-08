import { useEffect, useRef } from "react";

/**
 * Minimum downward distance (in px) that has to accumulate before the
 * top panel is allowed to *hide*. Anything tighter than this is
 * treated as accidental / inertial jitter on a trackpad or touchpad
 * and not worth an animation.
 */
export const TOP_PANEL_HIDE_TRIGGER_DELTA = 4;

/**
 * Once the user has scrolled further than this from the top of the
 * container, scrolling *down* triggers a hide. Below this we assume
 * the user is near the top of the page and wants the chrome visible
 * regardless of direction.
 */
export const TOP_PANEL_TOP_THRESHOLD_PX = 24;

/**
 * Pure decision function used by `useTopPanelScrollVisibility`.
 *
 * Returns one of:
 *   - `true`  -- show the panel.
 *   - `false` -- hide the panel.
 *   - `null`  -- no change (the scroll delta was below the trigger,
 *                so the previous state should be preserved).
 *
 * @param y         The current scroll Y.
 * @param lastY     The previous scroll Y the watchdog recorded.
 * @param topPx     The "we're still at the top" threshold.
 * @param triggerPx The minimum downward delta.
 * @param bottomY   When provided, an upward delta that lands at or
 *                  near `bottomY` is treated as rubber-band overscroll
 *                  and suppressed (`null` instead of `true`).
 */
export function computeNextShowPanel(
  y: number,
  lastY: number,
  topPx: number = TOP_PANEL_TOP_THRESHOLD_PX,
  triggerPx: number = TOP_PANEL_HIDE_TRIGGER_DELTA,
  bottomY: number | null = null,
): boolean | null {
  const delta = y - lastY;
  if (Math.abs(delta) < triggerPx) {
    return null;
  }
  if (delta > 0 && y > topPx) {
    // Scrolling down past the top -> hide.
    return false;
  }
  if (delta < 0) {
    // Rubber-band overscroll at the bottom edge: a real upward
    // scroll that should reveal the panel has to start from
    // somewhere the user can still see content above.
    if (bottomY !== null && y >= bottomY - 50) {
      return null;
    }
    return true;
  }
  return null;
}

/**
 * Watchdog hook that drives the top panel's show/hide state based on
 * the user's scroll direction inside the AppShell's main content
 * cell. Reads the scroll container from `useScrollElementStore` so
 * the hook stays decoupled from the AppShell layout (the hook can be
 * mounted from anywhere in the tree).
 *
 * Owns nothing UI-side; just attaches a passive `scroll` listener to
 * the configured target and forwards the outcome to `setShowPanel`.
 *
 * Args:
 *     element: the scroll container to watch. When `null` the
 *         watchdog stays idle (the panel stays visible).
 *     setShowPanel: the state setter for the top panel visibility.
 */
export function useTopPanelScrollVisibility(
  element: HTMLElement | null,
  setShowPanel: (show: boolean) => void,
): void {
  const lastYRef = useRef(0);

  useEffect(() => {
    if (!element) {
      return;
    }
    lastYRef.current = element.scrollTop;

    const handleScroll = () => {
      const y = element.scrollTop;
      const bottomY = element.scrollHeight - element.clientHeight;
      const next = computeNextShowPanel(
        y,
        lastYRef.current,
        TOP_PANEL_TOP_THRESHOLD_PX,
        TOP_PANEL_HIDE_TRIGGER_DELTA,
        bottomY,
      );
      lastYRef.current = y;
      if (next !== null) {
        setShowPanel(next);
      }
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [element, setShowPanel]);
}
