/**
 * whether the user is pressing ctrl/meta and a matching key
 *
 * Args:
 *     event: the keyboard event to check.
 *     key: the key next to ctrl/meta, e.g. `"k"` for ctrl+k.
 *         Pass an array of keys (e.g. `["q", "w", "e"]`) to match
 *         any of them. The match is case-insensitive either way.
 *
 * Returns:
 *     true if the user is pressing ctrl/meta and `event.key`
 *     matches the supplied key (or any entry in the array).
 */
export function isCtrlPlus(
  event: KeyboardEvent,
  key: string | string[],
): boolean {
  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }
  const pressed = event.key.toLowerCase();
  const targets = Array.isArray(key)
    ? key.map((k) => k.toLowerCase())
    : [key.toLowerCase()];
  return targets.includes(pressed);
}
