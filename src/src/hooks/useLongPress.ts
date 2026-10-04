import { useCallback, useEffect, useRef } from "react";

export interface UseLongPressOptions {
  /** Fire after holding this many ms. Defaults to 500. */
  threshold?: number;
  /**
   * Pixel slop allowed while holding. If the pointer moves more
   * than this, the gesture is cancelled (so the user can scroll
   * without triggering select-mode).
   */
  moveTolerance?: number;
  /** Called when the long-press fires. */
  onLongPress: (event: React.PointerEvent | React.MouseEvent | React.TouchEvent) => void;
  /** Called on the leading edge of a normal press, if provided. */
  onPress?: (event: React.PointerEvent | React.MouseEvent | React.TouchEvent) => void;
  /** Disable the gesture entirely. */
  disabled?: boolean;
}

interface LongPressBinding {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e?: React.PointerEvent) => void;
  onPointerCancel: (e?: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onKeyUp: (e?: React.KeyboardEvent) => void;
  /**
   * Ref the component can read inside its onClick to suppress the
   * trailing click that the browser fires after a successful
   * long-press release. Set to `true` while the click should be
   * ignored; auto-resets on the next pointer down.
   */
  longPressFired: React.MutableRefObject<boolean>;
}

/**
 * Pointer-friendly long-press binding. Activates after `threshold`
 * ms of held pointer-down; cancels on movement past `moveTolerance`
 * or on pointer-up / cancel / blur. Keyboard equivalent: hold Space
 * or Enter for the same duration.
 */
export function useLongPress(
  options: UseLongPressOptions,
): LongPressBinding {
  const {
    threshold = 500,
    moveTolerance = 10,
    onLongPress,
    onPress,
    disabled = false,
  } = options;

  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );
  const firedRef = useRef(false);
  const longPressFiredRef = useRef(false);
  const startEventRef = useRef<
    React.PointerEvent | React.MouseEvent | React.TouchEvent | null
  >(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
    startEventRef.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const fire = useCallback(() => {
    firedRef.current = true;
    longPressFiredRef.current = true;
    if (startEventRef.current) {
      onLongPress(startEventRef.current);
    }
    clear();
  }, [onLongPress, clear]);

  const begin = useCallback(
    (
      event: React.PointerEvent | React.MouseEvent | React.TouchEvent,
      x: number,
      y: number,
      pointerId: number,
    ) => {
      if (disabled) return;
      clear();
      firedRef.current = false;
      startRef.current = { x, y, pointerId };
      startEventRef.current = event;
      timerRef.current = window.setTimeout(fire, threshold);
    },
    [clear, disabled, fire, threshold],
  );

  const end = useCallback(() => {
    if (timerRef.current !== null) {
      if (!firedRef.current && onPress && startEventRef.current) {
        onPress(startEventRef.current);
      }
    }
    clear();
  }, [clear, onPress]);

  const move = useCallback(
    (x: number, y: number) => {
      const start = startRef.current;
      if (!start) return;
      const dx = x - start.x;
      const dy = y - start.y;
      if (Math.hypot(dx, dy) > moveTolerance) {
        clear();
      }
    },
    [clear, moveTolerance],
  );

  return {
    onPointerDown: (e) => {
      // Reset the public flag at the start of every gesture so the
      // trailing click after the previous long-press doesn't get
      // suppressed.
      longPressFiredRef.current = false;
      // Only the primary button starts the gesture; ignore right-click
      // and auxiliary buttons so context menus still work.
      if (e.button !== 0 && e.pointerType === "mouse") return;
      begin(e, e.clientX, e.clientY, e.pointerId);
    },
    onPointerMove: (e) => move(e.clientX, e.clientY),
    onPointerUp: () => end(),
    onPointerCancel: () => clear(),
    onKeyDown: (e) => {
      if (disabled) return;
      if (e.key !== " " && e.key !== "Enter") return;
      if (e.repeat) return;
      // Synthesize a pointer-like event so the same `begin` code
      // path drives the timer; the long-press consumer never reads
      // x/y from keyboard gestures.
      const synthetic = {
        clientX: 0,
        clientY: 0,
        pointerId: -1,
        pointerType: "keyboard",
        button: 0,
      } as unknown as React.PointerEvent;
      begin(synthetic, 0, 0, -1);
    },
    onKeyUp: (e) => {
      if (!e) return;
      if (e.key !== " " && e.key !== "Enter") return;
      end();
    },
    longPressFired: longPressFiredRef,
  };
}
