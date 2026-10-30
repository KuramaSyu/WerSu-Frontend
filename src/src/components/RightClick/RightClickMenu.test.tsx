// @vitest-environment jsdom

// Renderer behaviour: preset rows, key-chip hints, greyed rows.

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../test/setup";

vi.mock("../../utils/renderShortcut", () => ({
  renderShortcut: (shortcut: string) => (
    <span data-testid="shortcut">{shortcut}</span>
  ),
}));

import { RightClickMenu } from "./RightClickMenu";
import { resolveRightClickMenu } from "./resolveRightClickMenu";
import type { RightClickButtonRegistry, RightClickMenuRequest } from "./types";

const ok = () => true;

const registry: RightClickButtonRegistry = {
  copy: { id: "copy", label: "Copy", shortcut: "ctrl+c", handler: ok },
  paste: { id: "paste", label: "Paste", shortcut: "ctrl+v", handler: ok },
  edit: { id: "edit", label: "Edit" },
};

const request: RightClickMenuRequest = {
  position: { x: 0, y: 0 },
  buttons: ["copy", "paste", "edit"],
};

function renderMenu(overrides?: Partial<RightClickMenuRequest>) {
  const merged = { ...request, ...overrides };
  const rows = resolveRightClickMenu(merged, registry);
  return render(
    <RightClickMenu
      anchorPosition={{ top: 0, left: 0 }}
      rows={rows}
      getHandler={(row) =>
        row.kind === "button"
          ? (merged.overrides?.[row.buttonId]?.handler ??
            registry[row.buttonId]?.handler)
          : undefined
      }
      onRun={(handler) => handler(merged.targetId)}
      onClose={() => {}}
    />,
  );
}

const item = (label: string) => screen.getByText(label).closest("li");

describe("RightClickMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders copy and paste for a standard request", () => {
    renderMenu();
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Paste")).toBeInTheDocument();
  });

  it("renders key chips for the shortcut hints", () => {
    renderMenu();
    const hints = screen.getAllByTestId("shortcut").map((n) => n.textContent);
    expect(hints).toContain("ctrl+c");
    expect(hints).toContain("ctrl+v");
  });

  it("greys a disabled row instead of hiding it", () => {
    renderMenu();
    const editRow = item("Edit");
    expect(editRow).toBeInTheDocument();
    expect(editRow).toHaveAttribute("aria-disabled", "true");
  });

  it("leaves an enabled row not disabled", () => {
    renderMenu();
    expect(item("Copy")).not.toHaveAttribute("aria-disabled", "true");
  });

  it("omits the hint when the shortcut was cleared", () => {
    renderMenu({ overrides: { copy: { shortcut: null } } });
    expect(screen.getAllByTestId("shortcut")).toHaveLength(1);
  });

  it("runs the handler with the request target id", () => {
    const handler = vi.fn(() => true);
    renderMenu({
      targetId: "note:42",
      overrides: { copy: { handler } },
    });
    item("Copy")?.click();
    expect(handler).toHaveBeenCalledWith("note:42");
  });

  it("does not fire when a greyed row is clicked", () => {
    const handler = vi.fn(() => true);
    // canRun says there is nothing to act on, so copy stays greyed even
    // though it has a handler. The row must render, not fire.
    const gated: RightClickButtonRegistry = {
      ...registry,
      copy: { id: "copy", label: "Copy", handler, canRun: () => false },
    };
    const rows = resolveRightClickMenu(
      { ...request, buttons: ["copy"] },
      gated,
    );
    render(
      <RightClickMenu
        anchorPosition={{ top: 0, left: 0 }}
        rows={rows}
        getHandler={(row) =>
          row.kind === "button" ? gated[row.buttonId]?.handler : undefined
        }
        onRun={(fn) => fn(undefined)}
        onClose={() => {}}
      />,
    );
    const copyRow = item("Copy");
    expect(copyRow).toHaveAttribute("aria-disabled", "true");
    copyRow?.click();
    expect(handler).not.toHaveBeenCalled();
  });

  it("enables and fires a row once the registry has a handler", () => {
    const withHandler: RightClickButtonRegistry = {
      ...registry,
      edit: { id: "edit", label: "Edit", handler: ok },
    };
    const handler = vi.fn(() => true);
    const merged: RightClickMenuRequest = {
      ...request,
      overrides: { edit: { handler } },
    };
    const rows = resolveRightClickMenu(merged, withHandler);
    render(
      <RightClickMenu
        anchorPosition={{ top: 0, left: 0 }}
        rows={rows}
        getHandler={(row) =>
          row.kind === "button"
            ? (merged.overrides?.[row.buttonId]?.handler ??
              withHandler[row.buttonId]?.handler)
            : undefined
        }
        onRun={(fn) => fn(merged.targetId)}
        onClose={() => {}}
      />,
    );
    item("Edit")?.click();
    expect(handler).toHaveBeenCalled();
  });
});
