import { useEffect } from "react";
import { useShortcutModifierStore } from "../zustand/useShortcutModifierStore";

/**
 * Tracks whether the Ctrl/Cmd modifier is currently held.
 *
 * Mounted once at app boot so every `ShortcutHint` reads from
 * the same store. Without a global listener each hint would
 * register its own key listener, which would still work but
 * duplicates work and makes the modifier flag race against
 * listeners registered in different order.
 *
 * Behaviour:
 *
 * - `keydown` flips the flag on when Ctrl OR Meta is held (so
 *   Mac's Cmd key counts as "the modifier"). Reading
 *   `event.ctrlKey || event.metaKey` once on keydown is enough;
 *   we don't need to also listen for the modifier alone.
 * - `keyup` clears the flag when neither is held.
 * - `blur` clears the flag so a popover doesn't get stuck open
 *   after the user alt-tabs away with the modifier held.
 */
export function useGlobalModifier(): void {
  const setModifierPressed = useShortcutModifierStore(
    (s) => s.setModifierPressed,
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        setModifierPressed(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        setModifierPressed(false);
      }
    };
    const handleBlur = () => {
      setModifierPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [setModifierPressed]);
}
