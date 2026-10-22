// Pure request -> rows resolution. No React, no MUI, no side effects,
// so the ordering and gating rules are testable on their own.

import {
  RIGHT_CLOCK_BUTTON_ORDER,
  type ResolvedMenuEntry,
  type RightClickButtonId,
  type RightClickButtonRegistry,
  type RightClickMenuRequest,
} from "./types";

const ORDER_INDEX = new Map<RightClickButtonId, number>(
  RIGHT_CLOCK_BUTTON_ORDER.map((id, index) => [id, index]),
);

const UNORDERED = RIGHT_CLOCK_BUTTON_ORDER.length;

function orderIndex(id: RightClickButtonId): number {
  return ORDER_INDEX.get(id) ?? UNORDERED;
}

/** Canonical order wins over request order, and repeats collapse to one row. */
function canonicalOrder(ids: readonly RightClickButtonId[]): RightClickButtonId[] {
  return [...new Set(ids)].sort((a, b) => orderIndex(a) - orderIndex(b));
}

export function resolveRightClickMenu(
  request: RightClickMenuRequest,
  registry: RightClickButtonRegistry = {},
  disabled: ReadonlySet<RightClickButtonId> = new Set(),
): ResolvedMenuEntry[] {
  const entries: ResolvedMenuEntry[] = [];
  let previousIndex: number | null = null;

  for (const id of canonicalOrder(request.buttons)) {
    const override = request.overrides?.[id];
    if (override?.hidden) continue;
    if (disabled.has(id)) continue;

    const index = orderIndex(id);
    if (previousIndex !== null && index - previousIndex > 1) {
      entries.push({ kind: "divider", key: `divider-${id}` });
    }
    previousIndex = index;

    const definition = registry[id];
    const handler = override?.handler ?? definition?.handler;
    const canRun = definition?.canRun;
    // No handler at all means "waiting for a provider", so grey it out.
    const isDisabled =
      !handler || (canRun ? !canRun(request.targetId) : false);

    entries.push({
      kind: "button",
      key: `button-${id}`,
      buttonId: id,
      label: override?.label ?? definition?.label ?? id,
      icon: override?.icon ?? definition?.icon,
      shortcut:
        override?.shortcut === null
          ? undefined
          : (override?.shortcut ?? definition?.shortcut),
      disabled: isDisabled,
      submenu: request.submenus?.[id],
    });
  }

  for (const row of request.extraComponents ?? []) {
    entries.push({
      kind: "custom",
      key: row.key,
      label: row.label,
      icon: row.icon,
      shortcut: row.shortcut,
      disabled: row.disabled ?? false,
      node: row.node,
    });
  }

  return entries;
}