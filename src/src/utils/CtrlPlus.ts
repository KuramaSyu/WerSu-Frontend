/**
 * whether the user is pressing ctrl/meta and a specific key
 * @param event the keyboard event to check
 * @param key the key next to ctrl/meta, e.g. "k" for ctrl+k
 * @returns true if the user is pressing ctrl/meta and the specified key, false otherwise
 */
export function isCtrlPlus(event: KeyboardEvent, key: string): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === key.toLowerCase()
  );
}
