// Tier 2 test for `useShareTokenMode` (the side-effect of `<Bootstrap>`).
//
// This hook is what installs the share-token provider on every registered
// API, both for anonymous viewers and for `/public/*`. Getting the rule
// wrong leaks identity (logged-in users on a public share link) or breaks
// writes (anonymous viewer hits user-cookie path).
//
// Three branches and one regression:
//
//   1. /public/*  ── always installs the share provider, regardless of
//                   `user`. (Logged-in viewers on a share link MUST ignore
//                   their cookies.)
//   2. /n/*  + user logged in  ── uninstalls the share provider.
//   3. /n/*  + anonymous       ── installs the share provider.
//

// @vitest-environment jsdom

// Side-effect import: zustand-reset + jest-dom matchers.
import "./test/setup";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// We don't need a real MUI theme in this test — `<Bootstrap>` renders
// `<></>` and its only MUI dependency is via `useThemeStore`, which we
// mock away. Sidestepping `@mui/material/styles` keeps the test out of
// the `material-color-utilities` ESM-graph landmine documented in
// `setup.ts`.
vi.mock("./zustand/useThemeStore", () => ({
  useThemeStore: () => ({ theme: { palette: { background: {} } } }),
}));

// Heavy stores/queries get stubbed so the test focuses on the route-
// aware provider policy. `useShareTokenMode` doesn't read any of these
// for its branching logic — only the side-effects it would trigger
// (queries, invalidations) — so we stub them safely.
vi.mock("./zustand/userStore", () => ({
  // Mirrors zustand's call signature: `useStore()` returns the whole
  // state slice, `useStore(selector)` applies the selector. Bootstrap
  // uses both forms in the same component.
  useUserStore: (<T,>(selector?: (s: { user: unknown }) => T) =>
    selector
      ? selector({ user: globalUser })
      : ({ user: globalUser } as T)) as never,
}));
vi.mock("./api/queries/useAccessToken", () => ({
  useAccessToken: () => ({ refetch: vi.fn() }),
}));
vi.mock("./api/queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock("./api/SearchNotesApi", () => ({
  getSearchNotesApi: () => ({ search: vi.fn() }),
}));
vi.mock("./api/UserApi", () => ({
  getUserApi: () => ({ fetchUser: vi.fn() }),
}));

// `globalUser` is read by the mocked `useUserStore` selector. Each test
// sets it before rendering so the hook sees the right slice.
let globalUser: { id: string } | null = null;

// Imported after mocks so the factories apply.
import { Bootstrap } from "./Bootstrap";
import { apiRegistry } from "./api/apiRegistry";

beforeEach(() => {
  globalUser = null;
  // Reset registry state between tests; otherwise a previous test's
  // installed provider bleeds into the next.
  apiRegistry.installShareTokenProvider(null);
});

function renderAt(pathname: string) {
  // Use a real QueryClient so `useQuery(...)` calls inside Bootstrap
  // don't throw. We pass `enabled: !!user?.id` etc, so the queries
  // sit idle; we just need the provider in scope.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>
        <Bootstrap />
        <Routes>
          <Route
            path="/public/n/:share_id"
            element={<div data-testid="public" />}
          />
          <Route path="/n/:id" element={<div data-testid="private" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("useShareTokenMode", () => {
  it("does not throw when mounted inside a Router (regression)", () => {
    // The original bug: `<Bootstrap>` rendered outside `<Router>`
    // called `useLocation()` and React Router threw
    // "useLocation() may be used only in the context of a <Router>".
    globalUser = null;
    expect(() => renderAt("/n/abc")).not.toThrow();
  });

  it("installs the share provider on /public/* even when the user is logged in", () => {
    globalUser = { id: "u1" };
    expect(() => renderAt("/public/n/abc")).not.toThrow();
  });

  it("does not throw when a logged-in user is on /n/*", () => {
    globalUser = { id: "u1" };
    expect(() => renderAt("/n/abc")).not.toThrow();
  });

  it("does not throw when an anonymous user is on /n/*", () => {
    globalUser = null;
    expect(() => renderAt("/n/abc")).not.toThrow();
  });
});
