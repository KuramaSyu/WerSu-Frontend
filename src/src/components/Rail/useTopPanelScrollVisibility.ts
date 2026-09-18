import { useEffect, useRef } from "react";

// hide-trigger noise floor: deltas tighter than this are jitter, not intent
export const TOP_PANEL_HIDE_TRIGGER_DELTA = 4;

// below this scroll offset we never hide, regardless of direction
export const TOP_PANEL_TOP_THRESHOLD_PX = 24;

// top strip of the viewport where cursor movement re-reveals the panel
export const TOP_PANEL_HOVER_REVEAL_PX = 64;

function logTopPanel(reason: string, detail: Record<string, unknown>): void {
  console.log("[topbar]", reason, detail);
}

/** Decide show/hide from a scroll delta. true=show, false=hide, null=keep. */
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
    return false;
  }
  if (delta < 0) {
    // suppress rubber-band overscroll at the bottom edge
    if (bottomY !== null && y >= bottomY - 50) {
      return null;
    }
    return true;
  }
  return null;
}

/** Scroll watchdog. Disabled when enabled=false (panel is forced visible). */
export function useTopPanelScrollVisibility(
  element: HTMLElement | null,
  setShowPanel: (show: boolean) => void,
  enabled: boolean = true,
): void {
  const lastYRef = useRef(0);

  useEffect(() => {
    if (!enabled || !element) {
      logTopPanel("scroll-watchdog:skipped", {
        enabled,
        hasElement: !!element,
      });
      return;
    }
    lastYRef.current = element.scrollTop;
    logTopPanel("scroll-watchdog:armed", {
      enabled,
      initialY: lastYRef.current,
    });

    const handleScroll = () => {
      const y = element.scrollTop;
      const bottomY = element.scrollHeight - element.clientHeight;
      const delta = y - lastYRef.current;
      const next = computeNextShowPanel(
        y,
        lastYRef.current,
        TOP_PANEL_TOP_THRESHOLD_PX,
        TOP_PANEL_HIDE_TRIGGER_DELTA,
        bottomY,
      );
      lastYRef.current = y;
      if (next !== null) {
        logTopPanel("scroll:decision", {
          y,
          lastY: y - delta,
          delta,
          bottomY,
          next,
        });
        setShowPanel(next);
      } else {
        logTopPanel("scroll:no-change", {
          y,
          lastY: y - delta,
          delta,
          bottomY,
        });
      }
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      logTopPanel("scroll-watchdog:disarmed", { enabled });
      element.removeEventListener("scroll", handleScroll);
    };
  }, [element, setShowPanel, enabled]);

  useEffect(() => {
    if (!enabled) {
      logTopPanel("enabled:false-force-show", { enabled });
      setShowPanel(true);
    }
  }, [enabled, setShowPanel]);
}

/** Re-reveal a hidden panel when the cursor enters the top strip. */
export function useTopPanelHoverShow(
  setShowPanel: (show: boolean) => void,
  enabled: boolean,
  revealPx: number = TOP_PANEL_HOVER_REVEAL_PX,
): void {
  useEffect(() => {
    if (!enabled) {
      logTopPanel("hover-watchdog:skipped", { enabled, revealPx });
      return;
    }
    logTopPanel("hover-watchdog:armed", { enabled, revealPx });
    // Track the last "above the strip" reading so we only fire the
    // reveal on the OUTSIDE -> INSIDE crossing. Without this, every
    // mousemove inside the strip calls setShowPanel(true), which
    // produces a fresh LayoutContext value object even when the value
    // didn't change. That re-renders every useLayout() consumer
    // (including the note editor) per frame and tears down its
    // nodeviews. Starting the cursor below the strip means the
    // first inside-strip movement fires the reveal and subsequent
    // ones are no-ops until the cursor leaves and re-enters.
    let cursorAboveStrip = true;
    const handleMove = (e: MouseEvent) => {
      const inside = e.clientY <= revealPx;
      if (!inside) {
        cursorAboveStrip = true;
        return;
      }
      if (cursorAboveStrip) {
        cursorAboveStrip = false;
        logTopPanel("hover:reveal", { clientY: e.clientY, revealPx });
        setShowPanel(true);
      }
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => {
      logTopPanel("hover-watchdog:disarmed", { enabled, revealPx });
      window.removeEventListener("mousemove", handleMove);
    };
  }, [setShowPanel, enabled, revealPx]);
}
