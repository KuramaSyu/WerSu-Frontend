// Tier 2 test for useShareTokenMode (the side-effect of Bootstrap).
// Verifies the share-token provider is installed on /public/* and uninstalled for logged-in viewers.

// @vitest-environment jsdom

// Side-effect import: zustand-reset + jest-dom matchers.
import "./test/setup";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Bootstrap renders an empty fragment. Mock away useThemeStore to keep the test out of MUI.
vi.mock("./zustand/useThemeStore", () => ({
  useThemeStore: () => ({ theme: { palette: { background: {} } } }),
}));

// Heavy stores/queries get stubbed so the test focuses on the route-aware provider policy.
vi.mock("./zustand/userStore", () => ({
  // Mirrors zustand call signature: useStore() or useStore(selector). Bootstrap uses both.
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
// Stub useUser and useShareAccessToken: their transitive import of @mui/material hits an ESM-graph shim Vite 8 refuses.
vi.mock("./api/queries/useUser", () => ({
  useUser: () => ({
    data: globalUser,
    isLoading: false,
    isSuccess: true,
  }),
  useUserKey: () => null,
  // Auth gate mirror. useUser is already isSuccess in the test harness.
  useIsAuthenticated: () => true,
}));
vi.mock("./api/queries/useShareAccessToken", () => ({
  useShareAccessToken: () => undefined,
}));

// useFakeApiMode dynamically imports ./mocks/browser from inside a useEffect.
vi.mock("./mocks/browser", () => ({
  setApiMode: () => Promise.resolve(),
}));

// globalUser is read by the mocked useUserStore selector. Each test sets it before rendering.
let globalUser: { id: string } | null = null;

// Imported after mocks so the factories apply.
import { Bootstrap } from "./Bootstrap";
import { apiRegistry } from "./api/apiRegistry";

beforeEach(() => {
  globalUser = null;
  // Reset registry state between tests so a previous test's installed provider does not bleed.
  apiRegistry.installShareTokenProvider(null);
});

function renderAt(pathname: string) {
  // Use a real QueryClient so useQuery calls inside Bootstrap do not throw.
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
    // Original bug: Bootstrap rendered outside Router, useLocation threw with a "must be inside Router" error.
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
