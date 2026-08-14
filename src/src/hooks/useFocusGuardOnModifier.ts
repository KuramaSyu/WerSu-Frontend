import { useEffect, useRef } from "react";
import { useShortcutModifierStore } from "../zustand/useShortcutModifierStore";

/**
 * Re-focuses whatever was active the moment the Ctrl/Cmd
 * modifier went down.
 *
 * Why we need it: pressing Ctrl/Cmd triggers a global store
 * update that re-renders every `ShortcutHint` in the tree.
 * The Popover mount inside each hint runs synchronous DOM
 * mutations, and in some browsers/React batches those
 * mutations include a focus event on the new focusable
 * element (the wrapper span). Even when they don't, React's
 * reconciliation can shift focus when the input's
 * `autoFocus` re-evaluates against a new layout.
 *
 * Strategy:
 *
 *   - track the previous `isModifierPressed` value across
 *     renders (single shared ref -- mount this hook ONCE in
 *     the app, e.g. inside `Bootstrap`) so we detect a
 *     0 -> 1 transition;
 *   - at that transition, snapshot `document.activeElement`
 *     (so long as it isn't `<body>` -- restoring focus to
 *     `<body>` is meaningless);
 *   - in a microtask scheduled on the rising edge, re-focus
 *     the snapshot if it's still in the DOM.
 *
 * Returns nothing; this hook is a side effect.
 */
export function useFocusGuardOnModifier(): void {
  const isModifierPressed = useShortcutModifierStore(
    (s) => s.isModifierPressed,
  );
  const wasPressedRef = useRef<boolean>(false);

  useEffect(() => {
    const wasPressed = wasPressedRef.current;
    wasPressedRef.current = isModifierPressed;
    // Only act on the rising edge: 0 -> 1. On the falling
    // edge the user is releasing the modifier, no focus
    // movement we caused stays to undo.
    if (isModifierPressed && !wasPressed) {
      const target = document.activeElement;
      if (
        target instanceof HTMLElement &&
        target !== document.body &&
        typeof target.focus === "function"
      ) {
        queueMicrotask(() => {
          if (document.body.contains(target)) {
            target.focus();
          }
        });
      }
    }
  }, [isModifierPressed]);
}
