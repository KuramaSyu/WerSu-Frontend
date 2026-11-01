import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A single "hold a key to confirm" action.
 *
 * The component that renders the action bar owns the visuals; this
 * hook only tracks *which* action is currently being held. The visual
 * fill is what decides when the hold completes (via `complete`), so the
 * action fires exactly when the bar looks full instead of drifting from
 * a separate main-thread timer.
 */
export interface HoldKeyAction {
  /** `KeyboardEvent.key` value that triggers this action, e.g. "Escape". */
  key: string;
  /** Text shown next to the key badge, e.g. "exit source mode". */
  label: string;
  /** Optional shorter badge. Defaults to the uppercased `key`. */
  keyLabel?: string;
  /** How long the visual fill should take, in ms. Defaults to the bar's value. */
  duration?: number;
  /**
   * Allow the hold to arm even when the keyboard event originates from a
   * text field. Defaults to false so letter shortcuts (e.g. "i") never
   * fight normal typing. Set true for keys with no text meaning (Esc).
   */
  allowInTextFields?: boolean;
  /** Fired once the hold completes. */
  onTrigger: () => void;
}

export interface UseKeyHoldOptions {
  /** Whether key listening is enabled. When false no listeners attach. */
  enabled?: boolean;
  /** Actions that can be completed by holding their key. */
  actions: HoldKeyAction[];
  /**
   * Use the capture phase for the document listeners. Required when the
   * bar lives inside a surface that swallows Escape (e.g. a MUI
   * `Dialog`), and best left off for plain pages so a descendant can
   * consume the key first (e.g. the editor's find bar).
   */
  capture?: boolean;
}

export interface UseKeyHoldResult {
  /** The action currently being held, or `null` when idle. */
  holding: HoldKeyAction | null;
  /**
   * Complete the current hold: fires its `onTrigger` and clears the
   * holding state. The bar calls this when the fill animation ends.
   */
  complete: () => void;
}

/**
 * Tracks a held keyboard key. The caller decides when the hold has
 * completed by calling `complete()` — the bar wires this to the fill
 * animation's `animationend`, so the action lands the moment the bar is
 * visually full.
 *
 * The listeners never call `preventDefault`/`stopPropagation`, so a
 * short tap keeps whatever behaviour the focused surface owns. With
 * `capture` the document listener still observes the key before handlers
 * that swallow it (notably MUI's `Dialog` close-on-Escape). Releasing
 * early cancels the hold, as does the window losing focus.
 */
export function useKeyHold({
  enabled = true,
  actions,
  capture = true,
}: UseKeyHoldOptions): UseKeyHoldResult {
  const [holding, setHolding] = useState<HoldKeyAction | null>(null);
  const holdingRef = useRef<HoldKeyAction | null>(null);

  // Adjust state during render (React's recommended pattern) so that
  // disabling the listener also drops any half-finished hold. The ref is
  // cleared in the listener effect's cleanup below.
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (prevEnabled !== enabled) {
    setPrevEnabled(enabled);
    if (!enabled) {
      setHolding(null);
    }
  }

  // Keep the latest actions without rebinding listeners on every
  // render (a parent re-render shouldn't restart an in-flight hold).
  // Synced in an effect rather than during render so React's ref
  // lint rules stay happy.
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  const cancel = useCallback(() => {
    holdingRef.current = null;
    setHolding(null);
  }, []);

  const complete = useCallback(() => {
    const action = holdingRef.current;
    holdingRef.current = null;
    setHolding(null);
    action?.onTrigger();
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
    };

    const findAction = (key: string): HoldKeyAction | null =>
      actionsRef.current.find(
        (action) =>
          action.key === key || action.key.toLowerCase() === key.toLowerCase(),
      ) ?? null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || holdingRef.current) return;
      const action = findAction(event.key);
      if (!action) return;
      // Letter shortcuts must not hijack typing in the title, find bar,
      // etc. Esc-style actions opt in with `allowInTextFields`.
      if (!action.allowInTextFields && isTypingTarget(event.target)) return;

      holdingRef.current = action;
      setHolding(action);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = holdingRef.current;
      if (!action) return;
      if (findAction(event.key)?.key !== action.key) return;
      cancel();
    };

    const handleBlur = () => cancel();

    document.addEventListener("keydown", handleKeyDown, capture);
    document.addEventListener("keyup", handleKeyUp, capture);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, capture);
      document.removeEventListener("keyup", handleKeyUp, capture);
      window.removeEventListener("blur", handleBlur);
      holdingRef.current = null;
    };
  }, [enabled, capture, cancel]);

  return { holding, complete };
}
