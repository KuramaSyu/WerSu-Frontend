import { useEffect, useRef } from "react";
import { useDirectoryTypeAheadStore } from "../../zustand/useDirectoryTypeAheadStore";

/**
 * Marks a selectable row (directory or note) as a target for
 * keyboard type-ahead. The value is the row's `${kind}:${id}` key.
 */
export const DIRECTORY_NAV_ATTRIBUTE = "data-directory-nav";
/** The row's display name, matched (case-insensitively) against the pressed key. */
export const DIRECTORY_NAV_NAME_ATTRIBUTE = "data-directory-nav-name";

/**
 * A key released within this many ms of being pressed counts as a
 * short tap. Longer presses belong to the hold-to-run shortcut bar
 * (e.g. hold `e` = edit directory) and must not move the type-ahead
 * cursor.
 */
export const TYPE_AHEAD_TAP_MAX_MS = 400;

/**
 * Pressing the same letter again within this window advances to the
 * next match. Pausing longer restarts from the first match.
 */
export const TYPE_AHEAD_SEQUENCE_RESET_MS = 1200;

interface NavItem {
  key: string;
  /** Lower-cased display name used for prefix matching. */
  name: string;
  element: HTMLElement;
}

/** True when the event originates from a text field the user is typing in. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable === true
  );
}

/**
 * True when a modal dialog currently owns the screen, in which case
 * type-ahead must stay silent even though no text field has focus.
 */
export function isModalOpen(root: ParentNode = document): boolean {
  return root.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

/** Collects every selectable directory-view row currently in the DOM, in order. */
export function collectDirectoryNavItems(
  root: ParentNode = document,
): NavItem[] {
  const nodes = root.querySelectorAll<HTMLElement>(
    `[${DIRECTORY_NAV_ATTRIBUTE}]`,
  );
  const items: NavItem[] = [];
  nodes.forEach((element) => {
    const key = element.getAttribute(DIRECTORY_NAV_ATTRIBUTE);
    if (!key) return;
    const name = element.getAttribute(DIRECTORY_NAV_NAME_ATTRIBUTE) ?? "";
    items.push({ key, name: name.toLocaleLowerCase(), element });
  });
  return items;
}

/**
 * Keyboard type-ahead for the directory view.
 *
 * Tapping a letter jumps to the first selectable row whose name
 * starts with that letter and marks it; tapping the same letter
 * again cycles to the next match. Holding a letter (the existing
 * hold-to-run shortcuts such as `e` = edit) is left untouched
 * because navigation only happens on key-up of a short tap.
 *
 * Matching is done against the live DOM via `data-directory-nav`
 * attributes, so nested rows inside expanded chapters are included
 * automatically without threading the whole tree through this hook.
 */
export function useDirectoryTypeAhead(enabled = true): void {
  const setHighlighted = useDirectoryTypeAheadStore((s) => s.setHighlighted);
  const clear = useDirectoryTypeAheadStore((s) => s.clear);

  const pendingRef = useRef<{ key: string; at: number } | null>(null);
  const sequenceRef = useRef<{ letter: string; index: number; at: number }>({
    letter: "",
    index: -1,
    at: 0,
  });

  useEffect(() => {
    if (!enabled) {
      clear();
      return;
    }

    const resetSequence = () => {
      sequenceRef.current = { letter: "", index: -1, at: 0 };
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        resetSequence();
        clear();
        return;
      }
      if (event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // Single-character keys only (letters, digits, accented letters).
      if (event.key.length !== 1) return;
      if (!/[\p{L}\p{N}]/u.test(event.key)) return;
      if (isTypingTarget(event.target)) return;
      if (isModalOpen()) return;

      pendingRef.current = { key: event.key, at: Date.now() };
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const pending = pendingRef.current;
      if (!pending || pending.key !== event.key) return;
      pendingRef.current = null;

      // Long press: the hold-to-run shortcut owns this key.
      if (Date.now() - pending.at > TYPE_AHEAD_TAP_MAX_MS) {
        resetSequence();
        return;
      }
      if (isTypingTarget(event.target) || isModalOpen()) return;

      const letter = pending.key.toLocaleLowerCase();
      const matches = collectDirectoryNavItems().filter((item) =>
        item.name.startsWith(letter),
      );
      if (matches.length === 0) {
        resetSequence();
        clear();
        return;
      }

      const now = Date.now();
      const sequence = sequenceRef.current;
      const continueSequence =
        sequence.letter === letter &&
        now - sequence.at <= TYPE_AHEAD_SEQUENCE_RESET_MS;
      const index = continueSequence
        ? (sequence.index + 1) % matches.length
        : 0;
      sequenceRef.current = { letter, index, at: now };

      const match = matches[index];
      setHighlighted(match.key);
      match.element.focus({ preventScroll: true });
      // jsdom doesn't implement scrollIntoView; guard so tests don't crash.
      match.element.scrollIntoView?.({ block: "nearest" });
    };

    // Clicking elsewhere abandons the type-ahead cursor.
    const handlePointerDown = () => {
      resetSequence();
      pendingRef.current = null;
      clear();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [enabled, setHighlighted, clear]);
}
