/**
 * Tests for the top-bar scroll watchdog.
 *
 * Split into two tiers:
 *
 *   1. Pure unit tests against `computeNextShowBar` — the rule
 *      itself, no React, no DOM.
 *   2. Integration tests for `useTopBarScrollVisibility` via
 *      `@testing-library/react`'s `renderHook`, firing synthetic
 *      `scroll` events on a real jsdom node and observing how
 *      `setShowBar` is called over a sequence of movements.
 *
 * Both tiers compute their test fixtures from `TOPBAR_HIDE_TRIGGER_DELTA`
 * and `TOPBAR_TOP_THRESHOLD_PX` (rather than hardcoding 4 / 24), so
 * tuning either constant won't break the suite. The only absolute
 * expectations are the constant values themselves — and even those
 * are bounded, not pinned.
 */

// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeNextShowBar,
  TOPBAR_BOTTOM_EDGE_SLACK_PX,
  TOPBAR_HIDE_TRIGGER_DELTA,
  TOPBAR_TOP_THRESHOLD_PX,
  useTopBarScrollVisibility,
} from "./useTopBarScrollVisibility";

/**
 * Local aliases (read at module scope so a change to the constants
 * in `useTopBarScrollVisibility.ts` is picked up after vitest's
 * module cache invalidates — which it does between runs but not
 * mid-file). Tests derive every fixture from these.
 */
const TRIGGER = TOPBAR_HIDE_TRIGGER_DELTA;
const TOP_PX = TOPBAR_TOP_THRESHOLD_PX;

/**
 * Sanity check on the production constants. We don't pin exact
 * values — a future contributor is free to retune the scroll
 * feel — but the constants have to be in a range that makes the
 * feature work at all.
 *
 *   - trigger has to be > 0 (otherwise everything is "below
 *     threshold" and the bar never hides)
 *   - trigger has to be < 50 (otherwise the bar only reacts to
 *     full-screen jumps, which is the opposite of the intended
 *     "trackpad jitter" use case)
 *   - topPx has to be > 0
 *   - topPx has to be < 200 (otherwise the rule degenerates to
 *     "always hide on any downward scroll")
 *
 * These bounds are wide on purpose; tests should survive a
 * reasonable retune without changes.
 */
describe("constants are within a reasonable range", () => {
  it("trigger delta is positive but small (< 50)", () => {
    expect(TRIGGER).toBeGreaterThan(0);
    expect(TRIGGER).toBeLessThan(50);
  });

  it("top band threshold is positive but small (< 200)", () => {
    expect(TOP_PX).toBeGreaterThan(0);
    expect(TOP_PX).toBeLessThan(200);
  });
});

describe("computeNextShowBar()", () => {
  describe("noise suppression", () => {
    it("returns null when delta is exactly the trigger (not strictly smaller)", () => {
      // `Math.abs(delta) < trigger` is a strict less-than. A
      // delta of exactly `trigger` is a *real* scroll and should
      // be acted on, not swallowed.
      const lastY = 100;
      const y = lastY + TRIGGER; // exact threshold
      expect(y - lastY).toBeGreaterThanOrEqual(TRIGGER);
      // y is well past the top band for any sane TOP_PX, so the
      // expected outcome is `false` (hide), not `null`.
      expect(y).toBeGreaterThan(TOP_PX);
      expect(computeNextShowBar(y, lastY)).toBe(false);
    });

    it("returns null when delta is below the trigger", () => {
      // Half the trigger — guaranteed below as long as TRIGGER > 0
      // (which the sanity check above already pins).
      const half = Math.max(1, Math.floor(TRIGGER / 2));
      expect(computeNextShowBar(100 + half, 100)).toBeNull();
      expect(computeNextShowBar(100 - half, 100)).toBeNull();
      expect(computeNextShowBar(100, 100)).toBeNull();
    });
  });

  describe("scrolling down (delta > 0)", () => {
    it("hides the bar when past the top threshold", () => {
      // Anchor the start well above the top band so the end is
      // unambiguously past it, no matter the constant tuning.
      const delta = TRIGGER + 50;
      expect(computeNextShowBar(1000 + delta, 1000)).toBe(false);
      // "Just past" — a few pixels past the top band, with a
      // delta big enough to clear the trigger.
      const y = TOP_PX + 10;
      const lastY = y - delta;
      expect(y - lastY).toBeGreaterThan(TRIGGER);
      expect(computeNextShowBar(y, lastY)).toBe(false);
    });

    it("leaves state alone when still inside the top band", () => {
      // Anchor at a low y so even with a downward delta we stay
      // inside the top band.
      const y = Math.max(1, TOP_PX - 5); // safely inside [0, TOP_PX)
      const lastY = 0;
      const delta = y - lastY;
      // Sanity: this scenario only makes sense if the delta is
      // bigger than the trigger — otherwise it'd be in the noise
      // test's bucket regardless.
      expect(delta).toBeGreaterThan(TRIGGER);
      expect(y).toBeLessThanOrEqual(TOP_PX);
      expect(computeNextShowBar(y, lastY)).toBeNull();
    });
  });

  describe("scrolling up (delta < 0)", () => {
    it("shows the bar even from within the top band", () => {
      // Start near the top, scroll up — the rule says "any
      // upward scroll reveals the nav, no matter where we are".
      expect(computeNextShowBar(0, TOP_PX + 50)).toBe(true);
      expect(computeNextShowBar(0, 100)).toBe(true);
    });

    it("shows the bar mid-page too", () => {
      // Anchor comfortably past the top band regardless of tuning.
      const lastY = 5000;
      const y = lastY - (TRIGGER + 100);
      expect(computeNextShowBar(y, lastY)).toBe(true);
    });
  });

  describe("custom thresholds (smoke test the parameter path)", () => {
    // These exist to confirm the helper actually consumes its
    // optional arguments — they don't pin the production values.
    const customTrigger = 10;
    const customTopPx = 100;

    it("honours a custom trigger delta", () => {
      // 7-px delta → below custom trigger → null.
      expect(
        computeNextShowBar(107, 100, customTopPx, customTrigger),
      ).toBeNull();
      // Larger delta, past the custom top band → false.
      expect(
        computeNextShowBar(
          customTopPx + 12,
          customTopPx + 1,
          customTopPx,
          customTrigger,
        ),
      ).toBe(false);
    });

    it("honours a custom top threshold", () => {
      // delta inside the custom top band → null.
      expect(computeNextShowBar(8, 0, customTopPx, customTrigger)).toBeNull();
      // Larger delta that clears the custom trigger, past the
      // custom top band → false.
      const delta = customTrigger + 5;
      const y = customTopPx + delta;
      const lastY = customTopPx;
      expect(y - lastY).toBeGreaterThan(customTrigger);
      expect(y).toBeGreaterThan(customTopPx);
      expect(computeNextShowBar(y, lastY, customTopPx, customTrigger)).toBe(
        false,
      );
    });
  });

  describe("bottom-edge overscroll suppression", () => {
    const bottomY = 1000;
    // Anchor well above the top band, well below the bottom edge —
    // so any "show" decision is unambiguous. The bottom-edge guard
    // should suppress the upward signal here.
    const midPage = bottomY - 200;

    it("suppresses an upward delta when y is at the bottom edge", () => {
      // Rubber-band bounce: lastY at the very bottom, current y
      // one or two px short (the first overscroll frame lands
      // fractionally above max). Delta is negative and well past
      // the trigger.
      expect(
        computeNextShowBar(bottomY - 1, bottomY, TOP_PX, TRIGGER, bottomY),
      ).toBeNull();
      expect(
        computeNextShowBar(bottomY, bottomY + 1, TOP_PX, TRIGGER, bottomY),
      ).toBeNull();
    });

    it("suppresses within the configured slack", () => {
      // Just outside the slack — a real upward scroll that started
      // 10 px above the edge — should still show the bar.
      expect(
        computeNextShowBar(
          bottomY - TOPBAR_BOTTOM_EDGE_SLACK_PX - 10,
          bottomY,
          TOP_PX,
          TRIGGER,
          bottomY,
        ),
      ).toBe(true);
      // Inside the slack (lastY at the edge, y a fraction above)
      // → suppressed.
      expect(
        computeNextShowBar(
          bottomY - TOPBAR_BOTTOM_EDGE_SLACK_PX + 1,
          bottomY,
          TOP_PX,
          TRIGGER,
          bottomY,
        ),
      ).toBeNull();
    });

    it("still shows the bar on a real upward scroll that starts mid-page", () => {
      // Anchor comfortably below the top band; the upward delta
      // lands y well above the bottom edge.
      const lastY = midPage + TRIGGER + 50;
      const y = midPage;
      expect(y).toBeGreaterThan(TOP_PX);
      expect(y).toBeLessThan(bottomY - TOPBAR_BOTTOM_EDGE_SLACK_PX);
      expect(computeNextShowBar(y, lastY, TOP_PX, TRIGGER, bottomY)).toBe(
        true,
      );
    });

    it("passes bottomY through as null when omitted (unchanged behaviour)", () => {
      // No bottomY at all → the rule behaves like the pre-fix
      // version (every negative delta past the trigger shows).
      // Use a delta well above the trigger so the noise-suppression
      // short-circuit doesn't swallow the signal first.
      expect(
        computeNextShowBar(
          bottomY - (TRIGGER + 50),
          bottomY,
          TOP_PX,
          TRIGGER,
        ),
      ).toBe(true);
    });

    it("doesn't suppress downward hides at the bottom edge", () => {
      // Downward scroll that lands at the bottom should still hide
      // the bar — the bottom-edge guard only suppresses *upward*
      // signals.
      const lastY = bottomY - TRIGGER - 50;
      expect(computeNextShowBar(bottomY, lastY, TOP_PX, TRIGGER, bottomY)).toBe(
        false,
      );
    });
  });
});

describe("useTopBarScrollVisibility()", () => {
  let target: HTMLDivElement;
  let setShowBar: ReturnType<typeof vi.fn<(next: boolean) => void>>;

  beforeEach(() => {
    target = document.createElement("div");
    // jsdom's `scrollTop` is a getter/setter on `Element` — assign
    // through a property descriptor that the engine respects.
    Object.defineProperty(target, "scrollTop", {
      configurable: true,
      get() {
        return this._scrollTop ?? 0;
      },
      set(v: number) {
        this._scrollTop = v;
      },
    });
    document.body.appendChild(target);
    setShowBar = vi.fn();
  });

  afterEach(() => {
    target.remove();
    vi.restoreAllMocks();
  });

  /**
   * Dispatch a `scroll` event from inside the test, mimicking the
   * browser firing one after the user dragged / wheel-scrolled.
   * jsdom's `Event` defaults to non-bubbling but the listener is
   * attached directly on the target so non-bubbling is fine.
   */
  function scrollTo(y: number) {
    (target as unknown as { _scrollTop: number })._scrollTop = y;
    target.dispatchEvent(new Event("scroll"));
  }

  it("does nothing when no scroll event has fired yet", () => {
    renderHook(() => useTopBarScrollVisibility(target, setShowBar));
    expect(setShowBar).not.toHaveBeenCalled();
  });

  it("hides the bar on a meaningful downward scroll past the top", () => {
    renderHook(() => useTopBarScrollVisibility(target, setShowBar));
    // First scroll primes the ref to the current y = 0.
    scrollTo(0);
    setShowBar.mockClear();
    // Far past the top band, with a delta well above the trigger.
    scrollTo(TOP_PX + TRIGGER + 500);
    expect(setShowBar).toHaveBeenCalledWith(false);
  });

  it("shows the bar on a meaningful upward scroll", () => {
    renderHook(() => useTopBarScrollVisibility(target, setShowBar));
    scrollTo(TOP_PX + 500); // prime
    setShowBar.mockClear();
    scrollTo(TOP_PX); // upward, |delta| > trigger
    expect(setShowBar).toHaveBeenCalledWith(true);
  });

  it("ignores sub-threshold deltas without calling setShowBar", () => {
    renderHook(() => useTopBarScrollVisibility(target, setShowBar));
    scrollTo(0); // prime
    setShowBar.mockClear();
    // Half the trigger — guaranteed below as long as TRIGGER > 0.
    const half = Math.max(1, Math.floor(TRIGGER / 2));
    scrollTo(half); // +half px, below threshold
    scrollTo(half + 1); // +1 px more (still inside trigger for TRIGGER > 2)
    expect(setShowBar).not.toHaveBeenCalled();
  });

  it("leaves state alone when scrolling down within the top band", () => {
    renderHook(() => useTopBarScrollVisibility(target, setShowBar));
    scrollTo(0);
    setShowBar.mockClear();
    // Stay strictly inside [0, TOP_PX) so the rule says "null".
    // Pick a y that's at least (TRIGGER + 1) past 0 so the delta
    // itself isn't in the noise floor.
    const y = Math.min(Math.max(TRIGGER + 1, 1), TOP_PX - 1);
    scrollTo(y);
    expect(setShowBar).not.toHaveBeenCalled();
  });

  it("removes its scroll listener on unmount", () => {
    const { unmount } = renderHook(() =>
      useTopBarScrollVisibility(target, setShowBar),
    );
    scrollTo(0); // prime
    setShowBar.mockClear();
    unmount();
    scrollTo(TOP_PX + TRIGGER + 500); // way past the noise floor
    expect(setShowBar).not.toHaveBeenCalled();
  });

  it("re-binds the listener when scrollContainer changes", () => {
    // Second target.
    const other = document.createElement("div");
    Object.defineProperty(other, "scrollTop", {
      configurable: true,
      get() {
        return 0;
      },
      set() {
        // no-op
      },
    });
    document.body.appendChild(other);

    const { rerender } = renderHook(
      ({ node }: { node: HTMLDivElement }) =>
        useTopBarScrollVisibility(node, setShowBar),
      { initialProps: { node: target as HTMLDivElement } },
    );
    scrollTo(0); // prime first target
    setShowBar.mockClear();
    scrollTo(TOP_PX + TRIGGER + 500); // fires on first target
    expect(setShowBar).toHaveBeenCalledWith(false);
    setShowBar.mockClear();

    // Swap to the second target — listener should rebind.
    rerender({ node: other });
    other.dispatchEvent(new Event("scroll")); // first event on new target
    setShowBar.mockClear();
    other.dispatchEvent(new Event("scroll")); // second event with no real change
    // Old target should NOT fire the callback any more.
    scrollTo(TOP_PX + TRIGGER + 900);
    expect(setShowBar).not.toHaveBeenCalled();

    other.remove();
  });

  it("suppresses the rubber-band bounce at the bottom edge", () => {
    // Reproduce the production bug: user flings down, the page
    // reaches the bottom, the OS emits one more scroll event with
    // y a fraction above the max (overscroll), and a previous
    // build would have shown the top bar here. With the fix the
    // bar stays hidden.
    //
    // The test target simulates a `scrollHeight - clientHeight` of
    // 1000 by feeding the hook directly via a manual scroll event
    // with the `target.scrollTop` getter temporarily raised. We do
    // it by replacing the descriptor for the duration of this test.
    const fakeMax = 1000;
    Object.defineProperty(target, "scrollTop", {
      configurable: true,
      get() {
        return this._scrollTop ?? 0;
      },
      set(v: number) {
        this._scrollTop = v;
      },
    });

    // jsdom doesn't recompute layout, so `scrollHeight` is whatever
    // we set it to. We lie about both dimensions to make the guard
    // think the bottom is at `fakeMax`.
    Object.defineProperty(target, "scrollHeight", {
      configurable: true,
      get: () => fakeMax + 200,
    });
    Object.defineProperty(target, "clientHeight", {
      configurable: true,
      get: () => 200,
    });

    renderHook(() => useTopBarScrollVisibility(target, setShowBar));

    // Prime at the top, then fling all the way to the bottom in one
    // step. A single scroll event past the noise floor is enough to
    // hide the bar.
    (target as unknown as { _scrollTop: number })._scrollTop = 0;
    target.dispatchEvent(new Event("scroll"));
    setShowBar.mockClear();
    (target as unknown as { _scrollTop: number })._scrollTop = fakeMax;
    target.dispatchEvent(new Event("scroll"));
    expect(setShowBar).toHaveBeenCalledWith(false);
    setShowBar.mockClear();

    // Now the rubber-band bounce: y lands a fraction above the max.
    // This is the event that used to pop the top bar back in.
    (target as unknown as { _scrollTop: number })._scrollTop = fakeMax - 1;
    target.dispatchEvent(new Event("scroll"));
    expect(setShowBar).not.toHaveBeenCalled();

    // ... and a deeper bounce (further above the edge). Still
    // suppressed — the guard only opens up once we're comfortably
    // above the bottom slack.
    (target as unknown as { _scrollTop: number })._scrollTop = fakeMax - 50;
    target.dispatchEvent(new Event("scroll"));
    expect(setShowBar).not.toHaveBeenCalled();

    // A real upward scroll from well above the edge — bar reappears.
    (target as unknown as { _scrollTop: number })._scrollTop = fakeMax - 200;
    target.dispatchEvent(new Event("scroll"));
    expect(setShowBar).toHaveBeenCalledWith(true);
  });

  it("falls back to window when scrollContainer is null", () => {
    renderHook(() => useTopBarScrollVisibility(null, setShowBar));
    setShowBar.mockClear();

    // jsdom lets us write to window.scrollY.
    window.scrollY = 0;
    // Manually prime by firing once at zero (the hook records
    // `lastY` on mount via getY() — that's `window.scrollY`).
    window.dispatchEvent(new Event("scroll"));
    setShowBar.mockClear();

    window.scrollY = TOP_PX + TRIGGER + 500;
    window.dispatchEvent(new Event("scroll"));
    expect(setShowBar).toHaveBeenCalledWith(false);

    // Reset so other tests aren't affected.
    window.scrollY = 0;
  });
});
