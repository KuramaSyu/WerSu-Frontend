// Resolver rules: canonical ordering, kill switches, gating, overrides,
// dividers and trailing custom rows. Pure functions, no React, no MUI.

import { describe, expect, it, vi } from "vitest";
import { resolveRightClickMenu } from "./resolveRightClickMenu";
import type {
  ResolvedMenuButtonRow,
  ResolvedMenuCustomRow,
  ResolvedMenuDivider,
  ResolvedMenuEntry,
  RightClickButtonId,
  RightClickButtonRegistry,
  RightClickMenuRequest,
} from "./types";

const ok = () => true;

const registry: RightClickButtonRegistry = {
  copy: {
    id: "copy",
    label: "Copy",
    icon: "icon-copy",
    shortcut: "ctrl+c",
    handler: ok,
  },
  paste: {
    id: "paste",
    label: "Paste",
    icon: "icon-paste",
    shortcut: "ctrl+v",
    handler: ok,
  },
  cut: {
    id: "cut",
    label: "Cut",
    icon: "icon-cut",
    shortcut: "ctrl+x",
    handler: ok,
  },
  insert: { id: "insert", label: "Insert", icon: "icon-insert", handler: ok },
  table: { id: "table", label: "Table", icon: "icon-table", handler: ok },
  // Handlerless on purpose: a provider has to supply one.
  edit: { id: "edit", label: "Edit", icon: "icon-edit" },
  delete: { id: "delete", label: "Delete", icon: "icon-delete" },
  favourite: {
    id: "favourite",
    label: "Favourite",
    icon: "icon-star",
    handler: ok,
  },
};

function request(
  buttons: RightClickButtonId[],
  extra: Partial<RightClickMenuRequest> = {},
): RightClickMenuRequest {
  return { position: { x: 10, y: 20 }, buttons, ...extra };
}

/** returns button id or row kind */
const kinds = (rows: ResolvedMenuEntry[]) =>
  rows.map((row) => (row.kind === "button" ? row.buttonId : row.kind));

const asButton = (id: RightClickButtonId): ResolvedMenuButtonRow => {
  const entry = resolveRightClickMenu(request([id]), registry)[0];
  if (entry.kind !== "button")
    throw new Error(`expected a button row for ${id}`);
  return entry;
};

describe("resolveRightClickMenu ordering", () => {
  it("uses canonical catalogue order, not request order", () => {
    const rows = resolveRightClickMenu(
      request(["cut", "copy", "paste"]),
      registry,
    );
    expect(
      rows.map((row) => (row.kind === "button" ? row.buttonId : row.kind)),
    ).toEqual(["copy", "paste", "cut"]);
  });

  it("puts a later button ahead of an earlier one requested last", () => {
    const rows = resolveRightClickMenu(
      request(["favourite", "edit"]),
      registry,
    );
    expect(kinds(rows)).toEqual(["edit", "divider", "favourite"]);
  });

  it("collapses a repeated id to a single row", () => {
    const rows = resolveRightClickMenu(request(["copy", "copy"]), registry);
    expect(rows).toHaveLength(1);
  });

  it("returns nothing for an empty button list", () => {
    expect(resolveRightClickMenu(request([]), registry)).toEqual([]);
  });

  it("falls back to the id when the catalogue has no definition", () => {
    const rows = resolveRightClickMenu(request(["edit"]), {});
    expect(rows[0]).toMatchObject({
      kind: "button",
      label: "edit",
      disabled: true,
    });
  });
});

describe("resolveRightClickMenu kill switches", () => {
  it("drops a globally disabled button entirely", () => {
    const rows = resolveRightClickMenu(
      request(["copy", "paste"]),
      registry,
      new Set(["paste"]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "button", buttonId: "copy" });
  });

  it("ignores the kill switch for a hidden row twice over", () => {
    const rows = resolveRightClickMenu(
      request(["copy"]),
      registry,
      new Set(["copy"]),
    );
    expect(rows).toEqual([]);
  });
});

describe("resolveRightClickMenu gating", () => {
  it("disables a row that has no handler and no override", () => {
    expect(asButton("edit").disabled).toBe(true);
  });

  it("enables a handlerless row once a provider supplies a handler", () => {
    const rows = resolveRightClickMenu(
      request(["edit"], { overrides: { edit: { handler: ok } } }),
      registry,
    );
    expect(rows[0]).toMatchObject({ kind: "button", disabled: false });
  });

  it("disables a row when canRun reports nothing to act on", () => {
    const gated: RightClickButtonRegistry = {
      copy: { id: "copy", label: "Copy", handler: ok, canRun: () => false },
    };
    expect(resolveRightClickMenu(request(["copy"]), gated)[0]).toMatchObject({
      disabled: true,
    });
  });

  it("enables a row when canRun passes", () => {
    const canRun = vi.fn(() => true);
    const gated: RightClickButtonRegistry = {
      copy: { id: "copy", label: "Copy", handler: ok, canRun },
    };
    expect(resolveRightClickMenu(request(["copy"]), gated)[0]).toMatchObject({
      disabled: false,
    });
  });

  it("passes the target id through to canRun", () => {
    const canRun = vi.fn(() => true);
    const gated: RightClickButtonRegistry = {
      copy: { id: "copy", label: "Copy", handler: ok, canRun },
    };
    resolveRightClickMenu(request(["copy"], { targetId: "note:7" }), gated);
    expect(canRun).toHaveBeenCalledWith("note:7");
  });

  it("prefers an override handler over the catalogue handler", () => {
    const override = vi.fn(() => true);
    const rows = resolveRightClickMenu(
      request(["delete"], { overrides: { delete: { handler: override } } }),
      registry,
    );
    expect(rows[0]).toMatchObject({ buttonId: "delete", disabled: false });
  });
});

describe("resolveRightClickMenu overrides", () => {
  it("hides a row when the override sets hidden", () => {
    expect(
      resolveRightClickMenu(
        request(["copy", "cut"], { overrides: { cut: { hidden: true } } }),
        registry,
      ),
    ).toHaveLength(1);
  });

  it("relabels a row", () => {
    const rows = resolveRightClickMenu(
      request(["copy"], { overrides: { copy: { label: "Copy link" } } }),
      registry,
    );
    expect(rows[0]).toMatchObject({ label: "Copy link" });
  });

  it("swaps the icon", () => {
    const rows = resolveRightClickMenu(
      request(["copy"], { overrides: { copy: { icon: "icon-link" } } }),
      registry,
    );
    expect(rows[0]).toMatchObject({ icon: "icon-link" });
  });

  it("clears the hint when shortcut is null", () => {
    const rows = resolveRightClickMenu(
      request(["copy"], { overrides: { copy: { shortcut: null } } }),
      registry,
    );
    expect(rows[0]).toMatchObject({ shortcut: undefined });
  });

  it("keeps the catalogue hint when shortcut is undefined", () => {
    const rows = resolveRightClickMenu(
      request(["copy"], { overrides: { copy: { label: "Copy" } } }),
      registry,
    );
    expect(rows[0]).toMatchObject({ shortcut: "ctrl+c" });
  });

  it("replaces the hint when shortcut is a string", () => {
    const rows = resolveRightClickMenu(
      request(["copy"], { overrides: { copy: { shortcut: "super+c" } } }),
      registry,
    );
    expect(rows[0]).toMatchObject({ shortcut: "super+c" });
  });

  it("attaches a submenu to a button", () => {
    const submenu = { items: [{ id: "table", label: "Table", handler: ok }] };
    const rows = resolveRightClickMenu(
      request(["insert"], { submenus: { insert: submenu } }),
      registry,
    );
    expect(rows[0]).toMatchObject({ submenu });
  });
});

describe("resolveRightClickMenu dividers", () => {
  it("emits nothing when the rows are adjacent", () => {
    expect(
      kinds(resolveRightClickMenu(request(["copy", "paste"]), registry)),
    ).toEqual(["copy", "paste"]);
  });

  it("emits one divider for a gap", () => {
    expect(
      kinds(resolveRightClickMenu(request(["copy", "delete"]), registry)),
    ).toEqual(["copy", "divider", "delete"]);
  });

  it("emits a single divider however wide the gap is", () => {
    expect(
      kinds(resolveRightClickMenu(request(["copy", "favourite"]), registry)),
    ).toEqual(["copy", "divider", "favourite"]);
  });

  it("puts the divider before the row that follows the gap", () => {
    const rows = resolveRightClickMenu(request(["copy", "delete"]), registry);
    const divider = rows.find(
      (row) => row.kind === "divider",
    ) as ResolvedMenuDivider;
    const index = rows.indexOf(divider);
    expect(rows[index + 1]).toMatchObject({
      kind: "button",
      buttonId: "delete",
    });
  });

  it("keeps the gap visible when a disabled row sat between two shown ones", () => {
    const rows = resolveRightClickMenu(
      request(["copy", "paste", "cut"]),
      registry,
      new Set(["paste"]),
    );
    expect(kinds(rows)).toEqual(["copy", "divider", "cut"]);
  });
});

describe("resolveRightClickMenu extra rows", () => {
  it("appends custom rows after every built-in", () => {
    const rows = resolveRightClickMenu(
      request(["copy"], {
        extraComponents: [
          { key: "custom-1", label: "Share", node: "share-node" },
        ],
      }),
      registry,
    );
    expect(kinds(rows)).toEqual(["copy", "custom"]);
  });

  it("carries the custom row fields through", () => {
    const rows = resolveRightClickMenu(
      request([], {
        extraComponents: [
          {
            key: "custom-1",
            label: "Share",
            icon: "icon-share",
            shortcut: "super+s",
          },
        ],
      }),
      registry,
    );
    expect(rows[0]).toMatchObject({
      kind: "custom",
      key: "custom-1",
      label: "Share",
      icon: "icon-share",
      shortcut: "super+s",
      disabled: false,
    });
  });

  it("honours a disabled custom row", () => {
    const rows = resolveRightClickMenu(
      request([], {
        extraComponents: [{ key: "custom-1", label: "Share", disabled: true }],
      }),
      registry,
    );
    const row = rows[0] as ResolvedMenuCustomRow;
    expect(row.disabled).toBe(true);
  });
});

describe("resolveRightClickMenu leading rows", () => {
  const keyOf = (row: ResolvedMenuEntry) =>
    row.kind === "button" ? row.buttonId : row.key;

  it("renders leading rows before the buttons with a divider", () => {
    const rows = resolveRightClickMenu(
      request(["copy", "paste"], {
        leadingComponents: [{ key: "delete-table", label: "Delete table" }],
      }),
      registry,
    );
    expect(rows.map(keyOf)).toEqual([
      "delete-table",
      "divider-leading",
      "copy",
      "paste",
    ]);
  });

  it("omits the divider when there are no buttons", () => {
    const rows = resolveRightClickMenu(
      request([], {
        leadingComponents: [{ key: "only", label: "Only" }],
      }),
      registry,
    );
    expect(rows.map(keyOf)).toEqual(["only"]);
  });
});
