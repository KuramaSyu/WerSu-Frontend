// Pure request -> rows resolution. No React, no MUI, no side effects,
// so the ordering and gating rules are testable on their own.

import {
  RIGHT_CLOCK_BUTTON_ORDER,
  type ResolvedMenuCustomRow,
  type ResolvedMenuEntry,
  type RightClickButtonId,
  type RightClickButtonRegistry,
  type RightClickMenuRequest,
  type RightClickMenuRow,
} from "./types";

const ORDER_INDEX = new Map<RightClickButtonId, number>(
  RIGHT_CLOCK_BUTTON_ORDER.map((id, index) => [id, index]),
);

const UNORDERED = RIGHT_CLOCK_BUTTON_ORDER.length;

function orderIndex(id: RightClickButtonId): number {
  return ORDER_INDEX.get(id) ?? UNORDERED;
}

/** Canonical order wins over request order, and repeats collapse to one row. */
function canonicalOrder(
  ids: readonly RightClickButtonId[],
): RightClickButtonId[] {
  return [...new Set(ids)].sort((a, b) => orderIndex(a) - orderIndex(b));
}

function toCustomRow(row: RightClickMenuRow): ResolvedMenuCustomRow {
  return {
    kind: "custom",
    key: row.key,
    label: row.label,
    icon: row.icon,
    shortcut: row.shortcut,
    disabled: row.disabled ?? false,
    node: row.node,
    handler: row.handler,
    submenu: row.submenu,
  };
}

export function resolveRightClickMenu(
  request: RightClickMenuRequest,
  registry: RightClickButtonRegistry = {},
  disabled: ReadonlySet<RightClickButtonId> = new Set(),
): ResolvedMenuEntry[] {
  const entries: ResolvedMenuEntry[] = [];
  let previousIndex: number | null = null;

  const buttonIds = canonicalOrder(request.buttons).filter((id) => {
    const override = request.overrides?.[id];
    return !override?.hidden && !disabled.has(id);
  });

  // Caller rows first (for example the right-clicked element commands),
  // then a divider before the generic editor buttons.
  const leading = request.leadingComponents ?? [];
  for (const row of leading) entries.push(toCustomRow(row));
  if (leading.length > 0 && buttonIds.length > 0) {
    entries.push({ kind: "divider", key: "divider-leading" });
  }

  for (const id of buttonIds) {
    const override = request.overrides?.[id];
    const index = orderIndex(id);
    if (previousIndex !== null && index - previousIndex > 1) {
      entries.push({ kind: "divider", key: `divider-${id}` });
    }
    previousIndex = index;

    const definition = registry[id];
    const handler = override?.handler ?? definition?.handler;
    const canRun = definition?.canRun;
    // No handler at all means "waiting for a provider", so grey it out.
    const isDisabled = !handler || (canRun ? !canRun(request.targetId) : false);

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
    entries.push(toCustomRow(row));
  }

  return entries;
}
