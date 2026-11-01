import shortcutsJson from "./shortcuts.json";

export type ShortcutViewMode = "source" | "rich";

/** Editor state conditions that gate a shortcut. All present fields must match. */
export interface ShortcutWhen {
  viewMode?: ShortcutViewMode;
  editMode?: boolean;
  readOnly?: boolean;
}

export interface ShortcutConfig {
  /** Stable id used to attach the runtime handler. */
  id: string;
  /** Human-readable action name. */
  label: string;
  /**
   * `KeyboardEvent.key` that arms a hold/tap shortcut. Omitted for
   * combo shortcuts, which use `combo` instead.
   */
  key?: string;
  /**
   * Ctrl/Meta combo that fires this shortcut on key-down, e.g.
   * `"ctrl+/"`. Present means "tap combo", not a hold action.
   */
  combo?: string;
  /** Chip label rendered in the UI. Defaults to `combo`/`key`. */
  keyLabel?: string;
  /** When true the key must be held; otherwise a tap fires it. */
  hold?: boolean;
  /** Whether the hold also arms while a text field has focus. */
  allowInTextFields?: boolean;
  /** State conditions under which the shortcut is active. */
  when?: ShortcutWhen;
}

export interface ShortcutPageConfig {
  /** Human-readable page name. */
  label: string;
  /** Route the page lives on. */
  path: string;
  shortcuts: ShortcutConfig[];
}

export type ShortcutConfigMap = Record<string, ShortcutPageConfig>;

/** The whole shortcut catalogue, keyed by page id. */
export const shortcutConfig = shortcutsJson as unknown as ShortcutConfigMap;

export function getShortcutPage(page: string): ShortcutPageConfig | undefined {
  return shortcutConfig[page];
}

/** True when a shortcut fires as a Ctrl/Meta combo on key-down. */
export function isComboShortcut(shortcut: ShortcutConfig): boolean {
  return typeof shortcut.combo === "string" && shortcut.combo.length > 0;
}

/** The chip text rendered for a shortcut (combo, label, or key). */
export function shortcutDisplayKey(shortcut: ShortcutConfig): string {
  return shortcut.combo ?? shortcut.keyLabel ?? shortcut.key ?? "";
}

/**
 * True when a route pattern matches a pathname. Patterns may contain
 * `:param` segments (`/n/:id`); the special path `"everywhere"` matches
 * any path. Extra trailing segments are allowed so nested routes such as
 * `/d/:id/edit` still resolve to their parent page.
 */
export function matchesShortcutPath(
  pattern: string,
  pathname: string,
): boolean {
  if (pattern === "everywhere") return true;
  if (pattern === "/") return pathname === "/" || pathname === "";

  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  if (pathSegments.length < patternSegments.length) return false;

  return patternSegments.every((segment, index) =>
    segment.startsWith(":")
      ? pathSegments[index].length > 0
      : segment === pathSegments[index],
  );
}

/** The page id whose `path` matches the route, or `null` if none do. */
export function getShortcutPageIdForPath(pathname: string): string | null {
  for (const [id, page] of Object.entries(shortcutConfig)) {
    if (page.path === "everywhere") continue;
    if (matchesShortcutPath(page.path, pathname)) return id;
  }
  return null;
}

/**
 * The page ids relevant on a route: the active page first, then the
 * always-applicable `global` page. Used by the Ctrl+/ modal to show
 * only what applies where the user is.
 */
export function getRelevantShortcutPageIds(pathname: string): string[] {
  const current = getShortcutPageIdForPath(pathname);
  const ids: string[] = [];
  if (current) ids.push(current);
  if (shortcutConfig.global && current !== "global") ids.push("global");
  return ids;
}

/** The slice of runtime state a `when` condition can reference. */
export interface ShortcutState {
  viewMode: ShortcutViewMode;
  editMode: boolean;
  readOnly: boolean;
}

/** True when every field in `when` matches the current editor state. */
export function matchesShortcutState(
  when: ShortcutWhen | undefined,
  state: ShortcutState,
): boolean {
  if (!when) return true;
  if (when.viewMode !== undefined && when.viewMode !== state.viewMode) {
    return false;
  }
  if (when.editMode !== undefined && when.editMode !== state.editMode) {
    return false;
  }
  if (when.readOnly !== undefined && when.readOnly !== state.readOnly) {
    return false;
  }
  return true;
}

/** Short, human-readable summary of a `when` condition for the UI. */
export function describeShortcutState(when: ShortcutWhen | undefined): string {
  if (!when) return "Always";
  const parts: string[] = [];
  if (when.viewMode !== undefined) parts.push(`view: ${when.viewMode}`);
  if (when.editMode !== undefined) {
    parts.push(when.editMode ? "insert mode" : "read mode");
  }
  if (when.readOnly !== undefined) {
    parts.push(when.readOnly ? "read-only" : "writable");
  }
  return parts.join(" · ");
}
