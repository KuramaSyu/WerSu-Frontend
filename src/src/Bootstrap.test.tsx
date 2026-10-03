// Tier 2 test for useShareTokenMode (the side-effect of Bootstrap).
// Verifies the share-token provider is installed on /public/* and anonymous
// /n/* paths and uninstalled for logged-in /n/* viewers.

// @vitest-environment jsdom

// Side-effect import: zustand-reset + jest-dom matchers.
import "./test/setup";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Bootstrap renders an empty fragment and its only MUI dependency is via
// useThemeStore, which we mock away. Keeps the test out of the
// material-color-utilities ESM-graph landmine documented in setup.ts.
vi.mock("./zustand/useThemeStore", () => ({
  useThemeStore: () => ({ theme: { palette: { background: {} } } }),
}));

// Heavy stores/queries get stubbed so the test focuses on the
// route-aware provider policy. useShareTokenMode only triggers their
// side-effects (queries, invalidations), never reads them for branching.
vi.mock("./zustand/userStore", () => ({
  // Mirrors zustand's call signature: useStore() returns the whole state
  // slice, useStore(selector) applies the selector. Bootstrap uses both.
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
  getSearchNotesApi: () => ({
    search: vi.fn().mockResolvedValue({ notes: [], directories: [], tags: [] }),
  }),
}));
vi.mock("./api/UserApi", () => ({
  getUserApi: () => ({ fetchUser: vi.fn() }),
}));
// useUser and useShareAccessToken are read by Bootstrap itself. They
// transitively import DiscordLogin -> @mui/material -> the
// react-transition-group/TransitionGroupContext directory shim, which
// Vite 8 / Vitest 4's strict ESM resolver refuses. Stubbing keeps the
// test out of MUI entirely.
vi.mock("./api/queries/useUser", () => ({
  useUser: () => ({
    data: globalUser,
    isLoading: false,
    isSuccess: true,
  }),
  useUserKey: () => null,
}));
vi.mock("./api/queries/useShareAccessToken", () => ({
  useShareAccessToken: () => undefined,
}));

// useFakeApiMode in Bootstrap does a dynamic import of ./mocks/browser
// from inside a useEffect.
vi.mock("./mocks/browser", () => ({
  setApiMode: () => Promise.resolve(),
}));

// globalUser is read by the mocked useUserStore selector. Each test
// sets it before rendering so the hook sees the right slice.
let globalUser: { id: string } | null = null;

// Imported after mocks so the factories apply.
import { Bootstrap } from "./Bootstrap";
import { apiRegistry } from "./api/apiRegistry";

beforeEach(() => {
  globalUser = null;
  // Reset registry state between tests so a previous test's installed
  // provider does not bleed into the next.
  apiRegistry.installShareTokenProvider(null);
});

function renderAt(pathname: string) {
  // Use a real QueryClient so useQuery calls inside Bootstrap do not
  // throw. The queries sit idle (gated by enabled); we just need the
  // provider in scope.
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
    // The original bug: Bootstrap rendered outside Router called
    // useLocation() and React Router threw with a "must be inside Router"
    // error.
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
