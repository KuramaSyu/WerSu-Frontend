import { useEffect, useRef } from "react";

// hide-trigger noise floor: deltas tighter than this are jitter, not intent
export const TOP_PANEL_HIDE_TRIGGER_DELTA = 4;

// below this scroll offset we never hide, regardless of direction
export const TOP_PANEL_TOP_THRESHOLD_PX = 24;

// top strip of the viewport where cursor movement re-reveals the panel
export const TOP_PANEL_HOVER_REVEAL_PX = 64;

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
  }, [element, setShowPanel, enabled]);

  useEffect(() => {
    if (!enabled) {
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
      return;
    }
    const handleMove = (e: MouseEvent) => {
      if (e.clientY <= revealPx) {
        setShowPanel(true);
      }
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, [setShowPanel, enabled, revealPx]);
}
