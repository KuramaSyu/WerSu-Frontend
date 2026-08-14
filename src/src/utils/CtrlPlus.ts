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
