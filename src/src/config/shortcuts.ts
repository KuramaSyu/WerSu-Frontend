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
  /** `KeyboardEvent.key` that arms the shortcut. */
  key: string;
  /** Chip label rendered in the UI. Defaults to `key`. */
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
