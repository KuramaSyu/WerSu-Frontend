/**
 * Modifier options for `isCtrlPlus`.
 *
 * `alt` toggles whether Alt must be held alongside Ctrl/Meta.
 * By default `alt === false` -- plain ctrl (Mac: cmd) is enough.
 * Set `alt: true` for ctrl+alt combos (`Ctrl+Alt+N`).
 *
 * Why an options bag instead of a separate `isCtrlAlt`: one
 * predicate keeps every shortcut handler in the project on a
 * single modifier rule, and the `alt` flag mirrors how the
 * shortcut strings render (`"ctrl+alt+n"` -> "Ctrl + Alt + N"
 * via `renderShortcut`).
 */
export interface CtrlPlusOptions {
  /**
   * When `true`, also require Alt to be held. Defaults to false.
   */
  alt?: boolean;
}

/**
 * Whether the user is pressing ctrl/meta and a matching key.
 *
 * Args:
 *     event: the keyboard event to check.
 *     key: the key next to ctrl/meta, e.g. `"k"` for ctrl+k.
 *         Pass an array of keys (e.g. `["q", "w", "e"]`) to match
 *         any of them. The match is case-insensitive either way.
 *     options: optional `{ alt: true }` to additionally require
 *         Alt (e.g. for `Ctrl+Alt+N`). Defaults to plain
 *         Ctrl/Meta.
 *
 * Returns:
 *     true if the modifier(s) are held and `event.key` matches
 *     the supplied key (or any entry in the array).
 */
export function isCtrlPlus(
  event: KeyboardEvent,
  key: string | string[],
  options: CtrlPlusOptions = {},
): boolean {
  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }
  if (options.alt && !event.altKey) {
    return false;
  }
  if (!options.alt && event.altKey) {
    return false;
  }
  const pressed = event.key.toLowerCase();
  const targets = Array.isArray(key)
    ? key.map((k) => k.toLowerCase())
    : [key.toLowerCase()];
  return targets.includes(pressed);
}

/**
 * Whether a keyboard event matches a catalogue combo string such as
 * `"ctrl+/"` or `"ctrl+alt+n"`.
 *
 * The combo is parsed as `modifier... + key`; `ctrl`/`cmd`/`super`
 * map to the Ctrl/Meta rule enforced by `isCtrlPlus`, and an optional
 * `alt` modifier is honoured. Combos are always Ctrl/Meta based, which
 * keeps them isolated from plain typing.
 */
export function isCtrlCombo(event: KeyboardEvent, combo: string): boolean {
  const parts = combo
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length < 2) return false;

  const key = parts[parts.length - 1];
  const alt = parts.includes("alt");
  return isCtrlPlus(event, key, { alt });
}
