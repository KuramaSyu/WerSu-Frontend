// Shared types for the app-wide right-click menu.
//
// Type-only React import, so the pure resolver and its tests can use
// these without pulling in MUI.

import type { ReactNode } from "react";

export type RightClickButtonId =
  | "copy"
  | "paste"
  | "cut"
  | "insert"
  | "table"
  | "edit"
  | "delete"
  | "favourite";

/** Canonical catalogue order. The resolver sorts by this so menus never reflow per call site. */
export const RIGHT_CLOCK_BUTTON_ORDER: readonly RightClickButtonId[] = [
  "copy",
  "paste",
  "cut",
  "insert",
  "table",
  "edit",
  "delete",
  "favourite",
];

/** Handlers return false when there was nothing to act on, so the row can grey out. */
export type RightClickHandler = (targetId: string | undefined) => boolean;

export interface MenuPosition {
  x: number;
  y: number;
}

export interface RightClickMenuRequest {
  position: MenuPosition;
  /** Logical target: a note id, directory id, or "table:12". */
  targetId?: string;
  /** Which built-in buttons to show. Render order is canonical, not this order. */
  buttons: RightClickButtonId[];
  /** Per-button patch: relabel, swap icon, change shortcut, replace handler. */
  overrides?: Partial<Record<RightClickButtonId, RightClickButtonOverride>>;
  /** Any rows appended after the built-ins. */
  extraComponents?: RightClickMenuRow[];
  /** A hover submenu attached to one button, used by Insert. */
  submenus?: Partial<Record<RightClickButtonId, RightClickSubmenu>>;
}

export interface RightClickButtonOverride {
  label?: string;
  icon?: ReactNode;
  /** null clears the hint, undefined keeps the catalogue default. */
  shortcut?: string | null;
  handler?: RightClickHandler;
  hidden?: boolean;
}

export interface RightClickSubmenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  handler: RightClickHandler;
  disabled?: boolean;
}

export interface RightClickSubmenu {
  items: RightClickSubmenuItem[];
}

/** A caller-supplied row, rendered after every built-in button. */
export interface RightClickMenuRow {
  key: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  /** Fully custom content, used instead of the label when present. */
  node?: ReactNode;
}

export interface RightClickButtonDefinition {
  id: RightClickButtonId;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  /** Absent means the row renders disabled until a provider supplies one. */
  handler?: RightClickHandler;
  /** Lazy probe. False greys the row out rather than hiding it. */
  canRun?: (targetId: string | undefined) => boolean;
}

export type RightClickButtonRegistry = Partial<
  Record<RightClickButtonId, RightClickButtonDefinition>
>;

export interface ResolvedMenuButtonRow {
  kind: "button";
  key: string;
  buttonId: RightClickButtonId;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled: boolean;
  submenu?: RightClickSubmenu;
}

export interface ResolvedMenuCustomRow {
  kind: "custom";
  key: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled: boolean;
  node?: ReactNode;
}

export interface ResolvedMenuDivider {
  kind: "divider";
  key: string;
}

export type ResolvedMenuEntry =
  | ResolvedMenuButtonRow
  | ResolvedMenuCustomRow
  | ResolvedMenuDivider;