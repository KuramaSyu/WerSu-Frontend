// Tier 1 tests for the auth gate. The rule under test: only a genuine
// auth rejection (401/403/404) may bounce the viewer to /login. A
// dropped connection must keep them on the current route.

// @vitest-environment jsdom

import "../test/setup";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useRequireAuth } from "./useRequireAuth";
import { useUserStore } from "../zustand/userStore";
import { UserError } from "../api/models/UserError";

// Mutable snapshot the mocked `useUser` returns. `isAuthError` stays the
// real implementation so the test exercises the actual predicate.
const mockUser = {
  isLoading: false,
  isError: false,
  error: undefined as unknown,
};

vi.mock("../api/queries/useUser", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../api/queries/useUser")>();
  return {
    ...actual,
    useUser: () => mockUser,
  };
});

function Protected() {
  const allowed = useRequireAuth();
  return allowed ? <div>protected</div> : null;
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

function renderGate() {
  return render(
    <MemoryRouter initialEntries={["/n/note-x"]}>
      <LocationProbe />
      <Routes>
        <Route path="/n/note-x" element={<Protected />} />
        <Route path="/login" element={<div>login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUser.isLoading = false;
  mockUser.isError = false;
  mockUser.error = undefined;
  useUserStore.setState({ user: null, loggedOut: false });
});

describe("useRequireAuth - connection loss", () => {
  it("does not redirect when the user query fails with a network error", () => {
    mockUser.isError = true;
    mockUser.error = new TypeError("Failed to fetch");
    renderGate();
    // Stayed on the protected route; the identity is still considered
    // valid (we just could not confirm it).
    expect(screen.getByTestId("path").textContent).toBe("/n/note-x");
    expect(screen.getByText("protected")).toBeDefined();
  });

  it("does not redirect while an auth-agnostic retry is still pending", () => {
    mockUser.isLoading = true;
    mockUser.isError = true;
    mockUser.error = undefined;
    renderGate();
    expect(screen.getByTestId("path").textContent).toBe("/n/note-x");
  });
});

describe("useRequireAuth - genuine logout", () => {
  it("redirects to /login on a 401 auth error", () => {
    mockUser.isError = true;
    mockUser.error = new UserError("Failed", "Unauthorized", 401);
    renderGate();
    expect(screen.getByTestId("path").textContent).toBe("/login");
    expect(screen.getByText("login")).toBeDefined();
  });

  it("redirects to /login on a 404 auth error", () => {
    mockUser.isError = true;
    mockUser.error = new UserError("Failed", "Not found", 404);
    renderGate();
    expect(screen.getByTestId("path").textContent).toBe("/login");
  });

  it("redirects to /login on the explicit-logout latch", () => {
    useUserStore.setState({ user: null, loggedOut: true });
    renderGate();
    expect(screen.getByTestId("path").textContent).toBe("/login");
  });
});
