// Tier-1 component test for `ShelfMenu`.
//
// Behaviour we care about:
//   - clicking the button opens a menu listing every shelf from
//     `useShelves` plus an "All shelves" entry;
//   - the active shelf gets a check mark and the other rows don't;
//   - picking a shelf writes its id to `useSelectedShelfStore` and
//     closes the menu;
//   - picking "All shelves" clears the store selection;
//   - a placeholder shows when the shelves query is loading.
//
// `@mui/material` is mocked wholesale. `Menu` (and friends) pull in
// `react-transition-group/TransitionGroupContext`, which Vite 8's
// strict ESM resolver rejects under Vitest. `Bootstrap.test.tsx`
// hits the same landmine and dodges it the same way.

// @vitest-environment jsdom

import "../../test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSelectedShelfStore } from "../../zustand/useSelectedShelfStore";
import { ShelfMenu } from "./ShelfMenu";

// `useShelves` calls `getShelfApi()` at module scope. Replace it
// with a stub so this test doesn't try to talk to the real backend.
vi.mock("../../api/queries/shelfQueries", () => {
  return {
    useShelves: vi.fn(),
  };
});

// `useThemeStore` transitively imports `@mui/material/styles`,
// which fails in the Vitest `node` env. Replace it with a stub so
// the component sees a stable palette reference without paying the
// cost of loading the real theme.
vi.mock("../../zustand/useThemeStore", () => ({
  useThemeStore: () => ({
    theme: {
      palette: {
        text: { primary: "#000", secondary: "#666" },
        action: { hover: "#eee" },
      },
      typography: { body1: { fontSize: "0.875rem" } },
    },
  }),
}));

// Minimal MUI stand-ins. Each only renders the props the component
// actually uses in its render path.
vi.mock("@mui/material", () => ({
  Box: ({ children, ...rest }: { children?: ReactNode }) => (
    <div {...rest}>{children}</div>
  ),
  Button: ({
    children,
    onClick,
    endIcon,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    endIcon?: ReactNode;
  }) => (
    <button onClick={onClick} {...rest}>
      {children}
      {endIcon}
    </button>
  ),
  CheckIcon: () => null,
  InboxIcon: () => null,
  KeyboardArrowDownIcon: () => null,
  ShelvesIcon: () => null,
  CircularProgress: () => <span data-testid="progress" />,
  Divider: () => <hr />,
  ListItemIcon: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  ListItemText: ({
    primary,
    secondary,
  }: {
    primary?: ReactNode;
    secondary?: ReactNode;
  }) => (
    <span>
      {primary}
      {secondary ? <small> {secondary}</small> : null}
    </span>
  ),
  // The real `Menu` is a portal + click-outside + a11y beast; we
  // only need it to render its children when `open` is true and
  // expose its `anchorEl` + `onClose` to the parent. The component
  // sets `open` from `Boolean(anchor)` and only invokes `onClose`
  // when the user picks a row.
  Menu: ({
    children,
    open,
    onClose,
    anchorEl,
  }: {
    children?: ReactNode;
    open?: boolean;
    onClose?: () => void;
    anchorEl?: HTMLElement | null;
  }) =>
    open ? (
      <div role="menu" data-anchor={anchorEl ? "yes" : "no"}>
        {children}
        <button data-testid="menu-close" onClick={onClose}>
          close
        </button>
      </div>
    ) : null,
  MenuItem: ({
    children,
    onClick,
    selected,
    disabled,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    selected?: boolean;
    disabled?: boolean;
  }) => (
    <div
      role="menuitem"
      aria-disabled={disabled}
      data-selected={selected ? "yes" : "no"}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </div>
  ),
  Stack: ({
    children,
    ...rest
  }: {
    children?: ReactNode;
    direction?: "row" | "column";
  }) => <div {...rest}>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

// Import the mocked hook *after* the mock is registered so the
// `vi.fn()` reference we read here is the same one the component
// sees. Without this ordering we'd capture the original (unmocked)
// hook reference and `useShelves.mockReturnValue` would no-op.
import { useShelves } from "../../api/queries/shelfQueries";

const SHELVES = [
  { id: "shelf-1", slug: "alpha", display_name: "Alpha" },
  { id: "shelf-2", slug: "beta", display_name: "Beta" },
  {
    id: "shelf-3",
    slug: "gamma",
    display_name: "Gamma",
    book_ids: ["a", "b"],
  },
];

function renderShelfMenu() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ShelfMenu />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useSelectedShelfStore.setState({ selectedShelfId: null });
  vi.mocked(useShelves).mockReturnValue({
    data: SHELVES,
    isLoading: false,
  } as unknown as ReturnType<typeof useShelves>);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ShelfMenu", () => {
  it("renders the button label from the active shelf name", () => {
    useSelectedShelfStore.setState({ selectedShelfId: "shelf-2" });
    renderShelfMenu();
    expect(
      screen.getByRole("button", { name: /select shelf/i }),
    ).toHaveTextContent("Beta");
  });

  it("falls back to 'Shelf' when nothing is picked", () => {
    renderShelfMenu();
    expect(
      screen.getByRole("button", { name: /select shelf/i }),
    ).toHaveTextContent("Shelf");
  });

  it("opens a menu with an 'All shelves' row and one row per shelf", () => {
    renderShelfMenu();
    fireEvent.click(screen.getByRole("button", { name: /select shelf/i }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("All shelves")).toBeInTheDocument();
    for (const shelf of SHELVES) {
      expect(within(menu).getByText(shelf.display_name)).toBeInTheDocument();
    }
  });

  it("writes the picked id to the store and closes the menu", () => {
    renderShelfMenu();
    fireEvent.click(screen.getByRole("button", { name: /select shelf/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Beta/ }));

    expect(useSelectedShelfStore.getState().selectedShelfId).toBe("shelf-2");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("'All shelves' clears the store selection", () => {
    useSelectedShelfStore.setState({ selectedShelfId: "shelf-1" });
    renderShelfMenu();
    fireEvent.click(screen.getByRole("button", { name: /select shelf/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /All shelves/ }));

    expect(useSelectedShelfStore.getState().selectedShelfId).toBeNull();
  });

  it("renders a placeholder when the shelves query is loading", () => {
    vi.mocked(useShelves).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useShelves>);

    renderShelfMenu();
    fireEvent.click(screen.getByRole("button", { name: /select shelf/i }));

    expect(screen.getByText(/Loading shelves/i)).toBeInTheDocument();
  });
});
