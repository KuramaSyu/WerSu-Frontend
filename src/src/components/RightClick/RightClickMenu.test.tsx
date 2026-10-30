// @vitest-environment jsdom

// Renderer behaviour: preset rows, key-chip hints, greyed rows.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  insert: { id: "insert", label: "Insert", handler: ok },
  edit: { id: "edit", label: "Edit" },
};

const request: RightClickMenuRequest = {
  position: { x: 0, y: 0 },
  buttons: ["copy", "paste", "edit"],
};

function renderMenu(
  overrides?: Partial<RightClickMenuRequest>,
  onClose: () => void = () => {},
) {
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
      onClose={onClose}
    />,
  );
}

const submenuRequest: Partial<RightClickMenuRequest> = {
  buttons: ["insert"],
  submenus: {
    insert: { items: [{ id: "table", label: "Table", handler: ok }] },
  },
};

function renderSubmenu(onClose?: () => void) {
  renderMenu(submenuRequest, onClose);
  fireEvent.mouseEnter(item("Insert")!);
  return screen.getByText("Table");
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

  it("renders denser text than the MUI body default", () => {
    renderMenu();
    expect(item("Copy")).toHaveStyle({ fontSize: "0.8125rem" });

    const hint = screen.getAllByTestId("shortcut")[0];
    expect(hint.parentElement).toHaveStyle({ fontSize: "0.75rem" });
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

  it("opens the submenu on hover and closes it when the pointer leaves it", async () => {
    renderSubmenu();
    expect(screen.getByText("Table")).toBeInTheDocument();

    const paper = screen.getByText("Table").closest(".MuiPaper-root")!;
    // A modal wrapper would cover the viewport and never report a leave.
    expect(paper.closest(".MuiModal-root")).toBeNull();
    fireEvent.mouseLeave(paper);

    await waitFor(() =>
      expect(screen.queryByText("Table")).not.toBeInTheDocument(),
    );
  });

  it("marks submenu rows with a right chevron", () => {
    renderMenu(submenuRequest);
    const row = item("Insert");
    expect(row?.querySelector("svg")).not.toBeNull();
  });

  it("opens a submenu attached to a custom row", () => {
    const custom: RightClickMenuRequest = {
      position: { x: 0, y: 0 },
      buttons: [],
      extraComponents: [
        {
          key: "table-rows",
          label: "Rows",
          submenu: {
            items: [{ id: "delete-row", label: "Delete row", handler: ok }],
          },
        },
      ],
    };
    renderMenu(custom);
    expect(screen.queryByText("Delete row")).not.toBeInTheDocument();

    fireEvent.mouseEnter(item("Rows")!);
    expect(screen.getByText("Delete row")).toBeInTheDocument();
  });

  it("closes the whole menu when clicking outside while a submenu is open", () => {
    const onClose = vi.fn();
    renderSubmenu(onClose);

    // The submenu must not add its own backdrop, otherwise the click
    // would be swallowed and the parent menu would never close.
    const backdrops = document.querySelectorAll(".MuiBackdrop-root");
    expect(backdrops).toHaveLength(1);
    fireEvent.click(backdrops[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
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
